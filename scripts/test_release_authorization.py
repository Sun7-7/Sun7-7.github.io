"""Verify narrowly scoped owner approval without marking pending image rights verified."""
import io,json,shutil,tempfile,subprocess,zipfile
from pathlib import Path
from validate_publications import ROOT,validate,AUTHORIZATION_FILE

def main():
    results=[]
    candidate=validate(ROOT,release=True,check_output=True)
    if not candidate['owner_approved_snapshot']:
        assert candidate['errors']
        results.append({'case':'current_candidate_without_new_owner_approval_blocked','passed':True})
    with tempfile.TemporaryDirectory(prefix='qisun-release-test-') as tmp:
        site=Path(tmp)/'site'
        if candidate['owner_approved_snapshot']:
            shutil.copytree(ROOT,site,ignore=shutil.ignore_patterns('.git','node_modules','tmp','__pycache__','test-results'))
        else:
            # Exercise the real previously approved source, never invent a new
            # owner approval or change pending third-party rights in this tree.
            try:
                archive=subprocess.check_output(['git','archive','--format=zip','40f94e5c0020fb87e9cb63be4274f8f2c49cc27e'],cwd=ROOT,stderr=subprocess.DEVNULL)
            except (subprocess.CalledProcessError,FileNotFoundError):
                print(json.dumps({'results':results,'historical_snapshot_tests':'unavailable without baseline Git history'}));return
            with zipfile.ZipFile(io.BytesIO(archive)) as z:z.extractall(site)
        current=validate(site,release=True,check_output=True)
        assert current['owner_approved_snapshot'] and not current['errors']
        assert len(current['warnings'])==33
        results.append({'case':'approved_existing_snapshot','passed':True,'pending_rights_retained':33})
        app=site/'js/main.js';original=app.read_bytes();app.write_bytes(original+b'\n// later edit\n')
        assert validate(site,release=True)['errors'];app.write_bytes(original)
        results.append({'case':'later_source_edit_blocked','passed':True})
        asset=site/'assets/new-unapproved.svg';asset.write_text('<svg/>')
        assert validate(site,release=True)['errors'];asset.unlink()
        results.append({'case':'new_unapproved_asset_blocked','passed':True})
        figure=next((site/'assets/images/paper-figures').glob('*.png'));raw=figure.read_bytes();figure.write_bytes(raw+b'changed')
        assert validate(site,release=True)['errors'];figure.write_bytes(raw)
        results.append({'case':'changed_scientific_pixels_blocked','passed':True})
        approval=site/AUTHORIZATION_FILE;approval.unlink()
        assert validate(site,release=True)['errors']
        results.append({'case':'absent_owner_approval_blocked','passed':True})
    out=ROOT/'tmp/v36/logs';out.mkdir(parents=True,exist_ok=True)
    (out/'authorization_tests.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps({'release_authorization_tests':len(results),'passed':True}))

if __name__=='__main__':main()
