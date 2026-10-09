#!/usr/bin/env python3
"""重建分类规则：仅幻化装备、Action 20086 时尚配饰、Action 1013 鸟甲进入候选。"""
import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('rebuild_db', ROOT / 'build' / 'rebuild-db.py')
rebuild = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rebuild)


class CandidateClassificationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.actions = self.root / 'ItemAction.csv'
        with self.actions.open('w', encoding='utf-8', newline='') as f:
            w = csv.writer(f)
            w.writerow(['#', 'Action', 'Data[0]'])
            w.writerows([
                [402, 1013, 'barding'],
                [322, 1013, 'flyer shaffron'],
                [403, 1013, 'egg harness'],
                [1498, 1013, 'chocobo raincoat'],
                [2183, 20086, 'parasol'],
                [2745, 20086, 'black parasol'],
                [1441, 1322, 'mount parasol'],
            ])
        self.items = self.root / 'en-Item.csv'
        with self.items.open('w', encoding='utf-8', newline='') as f:
            w = csv.writer(f)
            w.writerow(['#', 'Name', 'EquipSlotCategory', 'ItemAction', 'IsGlamorous'])
            w.writerows([
                [8043, 'Gallant Armor Augmentation', 0, 0, 'False'],
                [27242, 'Amaro Barding Repair Materials', 0, 0, 'False'],
                [6032, 'Flyer Shaffron', 0, 322, 'False'],
                [7550, 'Egg Harness', 0, 403, 'False'],
                [21925, 'Chocobo Raincoat', 0, 1498, 'False'],
                [8881, 'Augmented Ironworks Belt', 0, 0, 'False'],
                [7551, 'Barding of Light', 0, 402, 'False'],
                [14972, 'Housemaid Brim', 1, 0, 'True'],
                [30269, 'Parasol', 0, 2183, 'False'],
                [48162, 'Black Embroidered Parasol', 0, 2745, 'False'],
                [6482, 'Linen Parasol', 0, 0, 'False'],
                [38459, 'Magicked Parasol', 0, 1441, 'False'],
                [90001, 'Invalid glam without equip slot', 0, 0, 'True'],
            ])

    def tearDown(self):
        self.tmp.cleanup()

    def test_action_rules_and_examples(self):
        action_map = rebuild._load_action_map(str(self.actions))
        flags = rebuild._load_glam(str(self.items), action_map)
        self.assertEqual(flags[8043], '0')
        self.assertEqual(flags[27242], '0')
        self.assertEqual(flags[6032], '1')
        self.assertEqual(flags[7550], '1')
        self.assertEqual(flags[21925], '1')
        self.assertEqual(flags[8881], '0')
        self.assertEqual(flags[7551], '1')
        self.assertEqual(flags[14972], '1')
        self.assertEqual(flags[30269], '1')
        self.assertEqual(flags[48162], '1')
        self.assertEqual(flags[6482], '0')
        self.assertEqual(flags[38459], '0')
        self.assertEqual(flags[90001], '0')

    def test_unknown_historical_item_defaults_to_excluded(self):
        old = {99999: ['99999', 'Historic item', 'Historic item', '旧物', '옛 물건', '', '', '', '1']}
        rows, _, _, _ = rebuild._merge_rows({}, {}, {}, {}, old, {})
        self.assertEqual(rows[0][0], 99999)
        self.assertEqual(rows[0][8], '0')

    def test_bad_or_missing_action_source_fails(self):
        bad = self.root / 'bad.csv'
        bad.write_text('#,Something\n1,2\n', encoding='utf-8')
        with self.assertRaises(SystemExit):
            rebuild._load_action_map(str(bad))
        missing = self.root / 'missing.csv'
        with self.assertRaises(SystemExit):
            rebuild._load_action_map(str(missing))


if __name__ == '__main__':
    unittest.main(verbosity=2)
