import { init } from "./panel.js";

if (!window.__autoSolverInjected) {
  window.__autoSolverInjected = true;
  init();
}
