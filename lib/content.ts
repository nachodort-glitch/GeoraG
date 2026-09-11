import data from "./countries.json";
export type Skill = "flag" | "capital" | "map";
export type Mode = Skill | "expedition";
export type Country = {
  id: string;
  code: string;
  name: string;
  aliases: string[];
  capital: string;
  capitalAliases: string[];
  continent: string;
  lat: number;
  lng: number;
  small: boolean;
  note: string;
};
export const countries = data as Country[];
export const byId = Object.fromEntries(
  countries.map((c) => [c.id, c]),
) as Record<string, Country>;
export const continents = [
  "Todo el mundo",
  "África",
  "América",
  "Asia",
  "Europa",
  "Oceanía",
];
export const skillNames: Record<Skill, string> = {
  flag: "Banderas",
  capital: "Capitales",
  map: "Mapa",
};
export const modeNames: Record<Mode, string> = {
  ...skillNames,
  expedition: "Expedición",
};
export const contentVersion = "2026.09.10-v1";
