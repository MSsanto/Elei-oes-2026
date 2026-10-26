import unittest
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('results', Path(__file__).parents[1] / 'scripts/collect_results_2026.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class ElectionResultsTests(unittest.TestCase):
    def test_elected_non_elected_and_unknown(self):
        self.assertEqual(mod.election_outcome({'e':'s','st':'Eleito por QP'}), 'eleito')
        self.assertEqual(mod.election_outcome({'e':'s','st':'Eleito por média'}), 'eleito')
        self.assertEqual(mod.election_outcome({'e':'n','st':'Não eleito'}), 'nao_eleito')
        self.assertEqual(mod.election_outcome({'e':'n','st':'Suplente'}), 'nao_eleito')
        self.assertIsNone(mod.election_outcome({'e':'n','st':'2º turno'}))
        self.assertIsNone(mod.election_outcome({'e':'n','st':'Indeferido'}))
        self.assertIsNone(mod.election_outcome({}))

    def test_only_final_counts_are_accepted(self):
        valid={'and':'f','s':{'pst':'100,00'},'carg':[{'agr':[{'par':[{'cand':[
            {'sqcand':'123','st':'Eleito por média','e':'s','vs':[{'sqcand':'999'}]},
            {'sqcand':'456','st':'Não eleito','e':'n'}]}]}]}]}]}
        parsed = mod.parse_results(valid, 6259, 6, 'sp', 'deputado-federal')
        self.assertEqual(set(parsed), {'123','456'})
        self.assertEqual(parsed['123']['situacao'], 'eleito')
        self.assertEqual(parsed['456']['situacao'], 'nao_eleito')
        invalid={**valid,'s':{'pst':'99,98'}}
        with self.assertRaises(ValueError):
            mod.parse_results(invalid, 6259, 6, 'sp', 'deputado-federal')

    def test_official_url_and_election_codes(self):
        self.assertEqual(mod.resource_url(6258,1,'br'), 'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json')
        self.assertTrue(any(e == 6259 and c == 6 and uf == 'sp' for e,c,uf,_ in mod.requests_plan()))

if __name__ == '__main__':
    unittest.main()
