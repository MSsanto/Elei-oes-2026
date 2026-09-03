from __future__ import annotations

import csv
import io
import json
import shutil
import sys
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

YEAR = 2026
CARGO = "DEPUTADO FEDERAL"
DATASET_URL = "https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026"
ZIP_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip"
UFS = (
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT",
    "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO",
    "RR", "SC", "SP", "SE", "TO",
)

ROOT = Path(__file__).resolve().parents[1]
COLLECTOR_DIR = ROOT / ".collector"
DOWNLOAD_DIR = COLLECTOR_DIR / "browser-downloads"
PROFILE_DIR = COLLECTOR_DIR / "chrome-profile"
PROCESSED_DIR = ROOT / "data" / "processed"
UF_DIR = PROCESSED_DIR / "ufs"


def normalize(value: object) -> str:
    return "" if value is None else str(value).strip()


def first(row: dict[str, str], *names: str) -> str:
    for name in names:
        value = normalize(row.get(name, ""))
        if value:
            return value
    return ""


def configure_driver():
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
    except ImportError as exc:
        raise RuntimeError(
            "Selenium nao esta instalado. Execute: python -m pip install --user selenium"
        ) from exc

    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    options = Options()
    # Janela visivel de proposito: reduz bloqueios de WAF e permite que o usuario
    # veja/complete qualquer desafio que o TSE eventualmente apresente.
    options.add_argument(f"--user-data-dir={PROFILE_DIR}")
    options.add_argument("--window-size=1280,900")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-notifications")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_experimental_option(
        "prefs",
        {
            "download.default_directory": str(DOWNLOAD_DIR),
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "safebrowsing.enabled": True,
        },
    )

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(120)
    try:
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {
                "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
            },
        )
        driver.execute_cdp_cmd(
            "Browser.setDownloadBehavior",
            {"behavior": "allow", "downloadPath": str(DOWNLOAD_DIR)},
        )
    except Exception:
        # O download ainda funciona via preferencia do Chrome em versoes que nao
        # aceitam um desses comandos CDP.
        pass
    return driver


def clean_download_dir() -> None:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    for item in DOWNLOAD_DIR.iterdir():
        if item.is_file():
            item.unlink(missing_ok=True)
        elif item.is_dir():
            shutil.rmtree(item, ignore_errors=True)


def wait_for_zip(timeout: int = 360) -> Path:
    deadline = time.time() + timeout
    last_size = -1
    stable_ticks = 0
    while time.time() < deadline:
        partials = list(DOWNLOAD_DIR.glob("*.crdownload"))
        zips = list(DOWNLOAD_DIR.glob("*.zip"))
        if zips and not partials:
            candidate = max(zips, key=lambda p: p.stat().st_mtime)
            size = candidate.stat().st_size
            if size > 1000 and size == last_size:
                stable_ticks += 1
                if stable_ticks >= 2:
                    return candidate
            else:
                stable_ticks = 0
                last_size = size
        time.sleep(2)
    raise RuntimeError("Timeout aguardando o download do ZIP do TSE pelo Chrome.")


def download_zip_via_browser() -> Path:
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait

    clean_download_dir()
    driver = configure_driver()
    try:
        print("Abrindo o Portal de Dados Abertos do TSE no Chrome...")
        driver.get(DATASET_URL)
        time.sleep(4)

        links = driver.find_elements(By.CSS_SELECTOR, 'a[href*="consulta_cand_2026.zip"]')
        if links:
            print("Recurso oficial encontrado na pagina. Iniciando download pelo navegador...")
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", links[0])
            time.sleep(1)
            driver.execute_script("arguments[0].click();", links[0])
        else:
            # Em algumas traducoes/versoes do CKAN o link e montado de outra forma.
            print("Link nao localizado no HTML; abrindo o recurso oficial diretamente apos criar sessao no portal...")
            driver.get(ZIP_URL)

        try:
            WebDriverWait(driver, 15).until(lambda d: True)
        except Exception:
            pass

        try:
            zip_path = wait_for_zip()
            print(f"ZIP baixado pelo Chrome: {zip_path.name} ({zip_path.stat().st_size / 1024 / 1024:.1f} MB)")
            return zip_path
        except RuntimeError as exc:
            page_text = ""
            try:
                page_text = driver.find_element(By.TAG_NAME, "body").text[:600]
            except Exception:
                pass
            if "403" in page_text or "Proibido" in page_text or "Forbidden" in page_text:
                raise RuntimeError(
                    "O Chrome tambem recebeu 403 do TSE. Se houver um desafio/confirmacao visivel na janela do navegador, conclua-o e rode novamente."
                ) from exc
            raise
    finally:
        driver.quit()


def decode_csv(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            text = raw.decode(encoding)
            if "DS_CARGO" in text[:10000] or "SQ_CANDIDATO" in text[:10000]:
                return text
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")


def normalize_candidate(row: dict[str, str]) -> dict[str, str]:
    uf = first(row, "SG_UF", "SG_UE")
    return {
        "ano_eleicao": str(YEAR),
        "uf": uf,
        "id_tse": first(row, "SQ_CANDIDATO"),
        "numero": first(row, "NR_CANDIDATO"),
        "nome": first(row, "NM_CANDIDATO"),
        "nome_urna": first(row, "NM_URNA_CANDIDATO", "NM_URNA") or first(row, "NM_CANDIDATO"),
        "partido": first(row, "SG_PARTIDO"),
        "numero_partido": first(row, "NR_PARTIDO"),
        "situacao_candidatura": first(
            row,
            "DS_SITUACAO_CANDIDATURA",
            "DS_SITUACAO_CANDIDATO",
            "DS_DETALHE_SITUACAO_CAND",
        ),
        "situacao_urna": first(row, "DS_SITUACAO_CANDIDATO_TOT"),
        "genero": first(row, "DS_GENERO"),
        "grau_instrucao": first(row, "DS_GRAU_INSTRUCAO"),
        "ocupacao": first(row, "DS_OCUPACAO"),
        "cor_raca": first(row, "DS_COR_RACA"),
        "data_nascimento": first(row, "DT_NASCIMENTO"),
        "email": first(row, "NM_EMAIL"),
        "foto_url": "",
        "ultima_atualizacao_tse": first(row, "DT_GERACAO"),
    }


def process_zip(zip_path: Path) -> list[dict[str, str]]:
    print("Processando CSVs oficiais do TSE...")
    candidates: dict[str, dict[str, str]] = {}
    with zipfile.ZipFile(zip_path) as archive:
        csv_names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        if not csv_names:
            raise RuntimeError("O ZIP do TSE nao contem arquivos CSV.")

        for name in csv_names:
            raw = archive.read(name)
            text = decode_csv(raw)
            reader = csv.DictReader(io.StringIO(text), delimiter=";")
            count = 0
            for row in reader:
                cargo = first(row, "DS_CARGO").upper()
                if cargo != CARGO:
                    continue
                item = normalize_candidate(row)
                if not item["id_tse"] or not item["uf"]:
                    continue
                candidates[item["id_tse"]] = item
                count += 1
            if count:
                print(f"  {Path(name).name}: {count} candidaturas a Deputado Federal")

    result = sorted(
        candidates.values(),
        key=lambda item: (item["uf"], item["nome_urna"].casefold(), item["id_tse"]),
    )
    if len(result) < 100:
        raise RuntimeError(f"Carga recusada por seguranca: apenas {len(result)} candidatos encontrados.")
    return result


def write_outputs(candidates: list[dict[str, str]]) -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    UF_DIR.mkdir(parents=True, exist_ok=True)

    (PROCESSED_DIR / "deputados_federais.json").write_text(
        json.dumps(candidates, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    ufs_with_records = []
    for uf in UFS:
        rows = [item for item in candidates if item["uf"] == uf]
        if rows:
            ufs_with_records.append(uf)
        (UF_DIR / f"{uf}.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    metadata = {
        "source": "Tribunal Superior Eleitoral — Portal de Dados Abertos",
        "source_url": DATASET_URL,
        "source_file_url": ZIP_URL,
        "source_mode": "chrome-selenium-download",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "cargo": CARGO,
        "cargo_code": 6,
        "records": len(candidates),
        "ufs": list(UFS),
        "ufs_with_records": len(ufs_with_records),
    }
    (PROCESSED_DIR / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"COLETA CONCLUIDA: {len(candidates)} candidaturas em {len(ufs_with_records)} UFs.")


def main() -> int:
    try:
        zip_path = download_zip_via_browser()
        candidates = process_zip(zip_path)
        write_outputs(candidates)
        return 0
    except Exception as exc:
        print(f"ERRO NO COLETOR VIA CHROME: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
