// What the outline script sets beside the viewer, for the tests that write a file.
import outlines from "virtual:molviz-outlines";

(globalThis as { molvizOutlines?: unknown }).molvizOutlines = outlines;
