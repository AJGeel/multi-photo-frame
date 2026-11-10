# Later

## Print-ready export

Exports are untagged 8-bit sRGB. PDFs use `/DeviceRGB` with a JPEG inside (`src/export.ts`). Good enough for most consumer print services, but these would make it more reliable:

1. **Embed an sRGB ICC profile.** In the PDF, use an `/ICCBased` colour space (optionally with an `/OutputIntent`). Also embed it in PNG (`iCCP` chunk) and JPEG (APP2 marker). Without one, printers guess the colour space.
2. **Higher quality for print.** Default JPEG quality to 100 for PDF. Consider a lossless option (Flate-compressed image in the PDF), though A3 at 300 DPI is about 17 MP, so files get large.
3. **Bleed and crop marks.** Printers usually want 3 mm of bleed. Extend the paper colour past the trim edge so a trimming error leaves no white sliver. This touches the size maths.
4. **Low-resolution warning.** Treat below about 200 effective DPI as risky for print.

Not planned: CMYK output. Hard in a browser, and most consumer printers convert from sRGB themselves. Revisit only for offset or commercial printing.

Ask the printer first: which colour profile, whether bleed is needed, and whether RGB PDFs are accepted.
