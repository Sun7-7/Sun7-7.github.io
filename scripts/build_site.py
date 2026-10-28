#!/usr/bin/env python3
"""Build the bilingual static candidate; --release enforces all review/rights gates."""
import argparse
from build_editorial import main
from validate_publications import validate

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--release',action='store_true')
    args=parser.parse_args()
    result=validate(release=args.release)
    if result['errors']:
        import json
        print(json.dumps(result,ensure_ascii=False,indent=2))
        raise SystemExit(1)
    main()
    if args.release:
        result=validate(release=True,check_output=True)
        if result['errors']:
            import json
            print(json.dumps(result,ensure_ascii=False,indent=2))
            raise SystemExit(1)
