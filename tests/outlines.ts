// What the outline script sets beside the viewer, for the tests that write a file.
import { OUTLINES_GLOBAL } from "virtual:molviz-fonts";
import outlines from "virtual:molviz-outlines";

(globalThis as Record<string, unknown>)[OUTLINES_GLOBAL] = outlines;
