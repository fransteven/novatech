import { describe, expect, it } from "vitest";
import { mapUpcItemDbResponse } from "@/lib/upc-lookup";
import { parseProductSuggestion, type CategoryForAi } from "@/services/product-ai-service";

describe("mapUpcItemDbResponse", () => {
  it("maps the first titled item and trims fields", () => {
    const data = mapUpcItemDbResponse({
      code: "OK",
      items: [
        {
          title: "  Sony DualSense   Wireless Controller ",
          brand: "Sony",
          color: "White",
          description: "",
          images: ["http://insecure.jpg", "https://img.example/1.jpg"],
        },
      ],
    });
    expect(data).toEqual({
      name: "Sony DualSense Wireless Controller",
      brand: "Sony",
      description: null,
      color: "White",
      model: null,
      category: null,
      imageUrl: "https://img.example/1.jpg",
    });
  });

  it("returns null without items", () => {
    expect(mapUpcItemDbResponse({ code: "OK", items: [] })).toBeNull();
    expect(mapUpcItemDbResponse({ code: "INVALID_UPC" })).toBeNull();
  });
});

describe("parseProductSuggestion", () => {
  const categories: CategoryForAi[] = [
    {
      id: "cat-gaming",
      name: "Controles",
      template: [
        { key: "plataforma", label: "Plataforma", type: "select", options: ["PS5", "Xbox Series"] },
        { key: "color", label: "Color", type: "text" },
        { key: "garantia_meses", label: "Garantía", type: "number" },
      ],
    },
  ];

  it("keeps only valid attributes of the chosen category", () => {
    const text =
      '```json\n{"categoryId":"cat-gaming","name":" Control DualSense PS5 Blanco ","description":"Control inalámbrico.","attributes":{"plataforma":"ps5","color":"Blanco","garantia_meses":"6","inventado":"x"}}\n```';
    expect(parseProductSuggestion(text, categories)).toEqual({
      categoryId: "cat-gaming",
      name: "Control DualSense PS5 Blanco",
      description: "Control inalámbrico.",
      attributes: { plataforma: "PS5", color: "Blanco", garantia_meses: 6 },
    });
  });

  it("drops an unknown category and unknown select options", () => {
    const text = '{"categoryId":"nope","name":"Figura Funko","attributes":{"plataforma":"Wii"}}';
    expect(parseProductSuggestion(text, categories)).toEqual({
      categoryId: null,
      name: "Figura Funko",
      description: "",
      attributes: {},
    });
  });

  it("throws when there is no JSON", () => {
    expect(() => parseProductSuggestion("no sé", categories)).toThrow();
  });
});
