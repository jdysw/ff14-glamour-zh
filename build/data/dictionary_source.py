"""Expand language-tagged source terms into the existing V3 dictionary shape."""
import json


def load_entries(path):
    with open(path, encoding='utf-8') as source:
        data = json.load(source)
    entries = dict(data['entries'])
    for term in data.get('terms', []):
        zh, names = term['zh'], term['names']
        if not isinstance(zh, str) or not zh.strip() or not isinstance(names, dict) or not names:
            raise ValueError(f'{path}: invalid multilingual term')
        for lang, aliases in names.items():
            if lang not in ('en', 'ja', 'ko') or not isinstance(aliases, list) or not aliases:
                raise ValueError(f'{path}: invalid term language {lang}')
            for alias in aliases:
                if (not isinstance(alias, str) or not alias.strip() or alias in entries
                        or alias in ('__proto__', 'constructor', 'prototype')):
                    raise ValueError(f'{path}: duplicate or invalid alias {alias!r}')
                entries[alias] = zh
    return entries
