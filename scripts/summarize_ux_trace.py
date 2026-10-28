"""Report real renderer-thread trace phases, separately from frame intervals."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def percentile(values,q=.95):
    values=sorted(values)
    return values[min(len(values)-1,int(len(values)*q))] if values else None
def main():
    records=[]
    for version in ['v34','v35']:
        metrics=json.loads((ROOT/f'tmp/v35/logs/{version}_interaction_benchmark.json').read_text())
        for m in metrics:
            events=json.loads((ROOT/f"tmp/v35/logs/{version}_{m['width']}_trace.json").read_text())['traceEvents']
            renderer={(e['pid'],e['tid']) for e in events if e['name']=='thread_name' and e.get('args',{}).get('name')=='CrRendererMain'}
            tasks=[e['dur']/1000 for e in events if (e['pid'],e['tid']) in renderer and e['name']=='RunTask' and e['ph']=='X']
            starts={};phases=[]
            for e in sorted(events,key=lambda x:x['ts']):
                if (e['pid'],e['tid']) not in renderer or e['name']!='AnimationFrame::Render':continue
                key=(e['pid'],e['tid'],json.dumps(e.get('id2',{}),sort_keys=True))
                if e['ph']=='b':starts[key]=e['ts']
                elif e['ph']=='e' and key in starts:phases.append((e['ts']-starts.pop(key))/1000)
            records.append({'version':version,'width':m['width'],'application_scroll_calls':len(m['scrollCalls']),
                'interaction_frame_interval_p95_ms':m['frameIntervalP95'],'interaction_long_tasks':m['longTasks'],
                'renderer_main_task_p95_ms':percentile(tasks),'renderer_main_task_samples':len(tasks),
                'renderer_frame_render_phase_p95_ms':percentile(phases),'renderer_frame_render_phase_max_ms':max(phases) if phases else None,
                'renderer_frame_render_phase_samples':len(phases),'layout_shift_sum_including_recent_input':sum(x['value'] for x in m['shifts']),
                'notes':'Real headless Edge desktop trace; mobile is a viewport/touch emulation. Render phase is main-thread wall time, not per-frame CPU utilization. Trace phase samples include navigation/capture; interaction frame intervals are reset after loading. No claim of physical 60Hz-device performance.'})
    (ROOT/'tmp/v35/logs/ux_before_after_summary.json').write_text(json.dumps(records,indent=2))
    print(json.dumps(records,indent=2))
if __name__=='__main__':main()
