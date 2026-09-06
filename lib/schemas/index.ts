export * from "./app-settings";
export * from "./capture";
export * from "./captured";
export * from "./domain";
// ./milestone is gone (shape plan P5 / §08). It held the milestone schemas —
// retired with the rollup they drove — and the project_checklist_items
// schemas, which had no reader outside the generated types. Both tables were
// dropped in §08 Phase B (docs/adr/0056).
export * from "./note";
export * from "./person";
export * from "./project";
export * from "./quote";
export * from "./routine";
export * from "./task";
export * from "./time";
