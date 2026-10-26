import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import enrich_votes_2026 as votes


def record(id, result, votes_count, round_id=6259):
    return {'sqcand': str(id), 'st': result, 'e': 's' if result.startswith('Eleito') else 'n',
            'vap': votes_count, 'vs': [{'sqcand': '99999', 'vap': 9999}]}


class VoteCountTests(unittest.TestCase):
    def test_votes_integer_and_zero_without_percent_or_locale_guessing(self):
        self.assertEqual(votes.validated_votes(123456), 123456)
        self.assertEqual(votes.validated_votes('0'), 0)
        self.assertIsNone(votes.validated_votes('12.345'))
        self.assertIsNone(votes.validated_votes('12,4'))
        self.assertIsNone(votes.validated_votes(None))
        self.assertIsNone(votes.validated_votes(True))

    def test_official_final_source_by_candidate_and_round(self):
        source={'and':'f','s':{'pst':'100,00'},'carg':[{'agr':[{'par':[{'cand':[
            record('123','Eleito por QP','98765'),
            record('456','Não eleito','42'),
        ]}]}]}]}
        meta={'eleicao':6259,'cargo':'deputado-federal','uf':'SP'}
        parsed=votes.parse_vote_source(meta,source)
        self.assertEqual(set(parsed), {'123','456'})
        self.assertEqual(parsed['123']['votos'],98765)
        self.assertEqual(parsed['456']['votos'],42)
        self.assertEqual(parsed['123']['turno'],1)
        self.assertNotIn('99999',parsed)
        meta_runoff={'eleicao':6258,'cargo':'presidente','uf':'BR'}
        self.assertEqual(votes.parse_vote_source(meta_runoff,source)['123']['turno'],2)
        with self.assertRaises(ValueError):
            votes.parse_vote_source(meta,{**source,'s':{'pst':'99'}})

    def test_preserves_status_and_requires_exact_identity(self):
        original={'candidaturas':{
          '123':{'situacao':'eleito','detalhe':'Eleito por QP','cargo':'deputado-federal','uf':'SP','eleicao':'6259'},
          '456':{'situacao':'nao_eleito','detalhe':'Não eleito','cargo':'deputado-federal','uf':'SP','eleicao':'6259'},
        }}
        official={
          '123':{'situacao':'eleito','cargo':'deputado-federal','uf':'SP','eleicao':'6259','votos':98765,'turno':1},
          '456':{'situacao':'nao_eleito','cargo':'deputado-federal','uf':'SP','eleicao':'6259','votos':42,'turno':1},
        }
        enriched=votes.apply_votes(original,official)
        self.assertEqual(enriched['candidaturas']['123']['votos'],98765)
        self.assertEqual(enriched['candidaturas']['456']['votos'],42)
        self.assertEqual(enriched['candidaturas']['123']['detalhe'],'Eleito por QP')
        self.assertNotIn('votos',original['candidaturas']['123'])
        official['456']['situacao']='eleito'
        with self.assertRaisesRegex(ValueError,'divergência'):
            votes.apply_votes(original,official)
        del official['456']
        with self.assertRaisesRegex(ValueError,'Cobertura'):
            votes.apply_votes(original,official)

if __name__ == '__main__':
    unittest.main()
