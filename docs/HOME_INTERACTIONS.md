# Home hover interactions

Hero CV/contact/profile links now use a short upward motion and an animated underline; the CV button smoothly fills with the existing accent color. Keyboard focus receives the same visible feedback.

Selected-publication domains remain equal width by default. At desktop widths of at least 1100 px with a fine hover pointer, the hovered domain expands to a 1.5fr track and its neighbors shrink to 0.75fr, over 500 ms. The original scientific image grows from 122 px to 176 px in height; neighboring images shrink to 108 px, using object-fit containment. Titles and paper descriptions remain available in every column. Pointer exit restores the default layout. Keyboard focus also highlights the corresponding column when the pointer is outside the group.

Touch devices and narrow screens keep their existing static layout. Reduced-motion preferences suppress transitions. This is CSS enhancement only; publication data, figures, link targets and viewer logic are unchanged. It does not merge or deploy the candidate.
