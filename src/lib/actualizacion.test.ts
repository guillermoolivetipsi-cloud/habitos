import { expect, it } from "vitest";
import { numeroDeTag } from "./actualizacion";

it("el número de versión sale del final del tag", () => {
  expect(numeroDeTag("v1.0.7")).toBe(7);
  expect(numeroDeTag("v1.0.12")).toBe(12);
  expect(numeroDeTag("cualquier cosa")).toBe(0);
});
