# V3.8 motion refinement

The research accordion previously mixed `minmax(0,1fr)` with pixel row sizes, so its grid transition changed discretely. Desktop rows now use measured pixel targets with a 460 ms easing curve. All desktop paper headings retain the same layout in open and closed states.

Manual/touch accordions animate from their current rendered height to their natural target height over 440 ms. A new selection cancels the previous animation from its visible height. Closed panels remain inert and hidden from assistive technology. The original document scroll behavior and focus protection remain.

Figure tracks use a 420 ms transition; caption heights and opacity follow. Caption targets account for final column width. Hover intent is measured once per target, with a short leave grace period. Paper scroll selection has a small bidirectional dead band to prevent boundary chatter. Navigation emphasis and progress changes also ease.

Reduced-motion preferences suppress CSS and scripted animations. Original figures, paper metadata, scientific prose, source links and data files are unchanged.

Verification: `node scripts/check_motion.cjs` compares rendered frame geometry against commit `0fc4c848cd66bc652929f358daf3f8d984bf93a6`, with desktop and touch sizes, Chinese/English, light/dark, interrupted selections and reduced motion. The baseline requires Git history. Run a static server on 8098 first. `REVIEW_PACKET_DIR=tmp/motion node scripts/check_site_v38.cjs` runs the existing full Research and page regression suite; PowerShell environment-variable syntax differs.

Local recordings and detailed reports belong in the main project's ignored deliverables directory. These checks do not certify physical mobile devices, native Safari, screen readers or real-user frame rates. This remains a draft candidate; production was not changed.
