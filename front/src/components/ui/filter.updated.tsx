"use client";

import { useState } from "react";

type FilterOption = {
  id: string;
  label: string;
};

type FilterGroup = {
  id: string;
  title: string;
  options: FilterOption[];
};

const FILTER_GROUPS: FilterGroup[] = [
  {
    id: "style",
    title: "Estilo de viagem",
    options: [
      { id: "cultural", label: "Cultural" },
      { id: "romantico", label: "Romântico" },
      { id: "aventura", label: "Aventura" },
      { id: "relaxante", label: "Relaxante" },
      { id: "praia", label: "Praia" },
    ],
  },
  {
    id: "duration",
    title: "Duração",
    options: [
      { id: "curta", label: "Até 4 dias" },
      { id: "media", label: "5 a 7 dias" },
      { id: "longa", label: "8+ dias" },
    ],
  },
  {
    id: "budget",
    title: "Orçamento",
    options: [
      { id: "econômico", label: "Econômico" },
      { id: "intermediario", label: "Intermediário" },
      { id: "premium", label: "Premium" },
    ],
  },
  {
    id: "destination",
    title: "Tipo de destino",
    options: [
      { id: "nacional", label: "Nacional" },
      { id: "internacional", label: "Internacional" },
      { id: "frio", label: "Frio" },
      { id: "tropical", label: "Tropical" },
    ],
  },
];

const INITIAL_SELECTED = new Set(["cultural", "media", "intermediario"]);

export default function Filter() {
  const [selected, setSelected] = useState<Set<string>>(INITIAL_SELECTED);
  const [isOpen, setIsOpen] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function clearFilters() {
    setSelected(new Set());
  }

  const filterContent = (
    <div className="rounded-lg border border-line bg-white p-6 md:p-7">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
          Filtros
        </p>

        <button
          type="button"
          onClick={clearFilters}
          className="text-xs font-medium text-ink-muted hover:text-ink"
        >
          Limpar
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {FILTER_GROUPS.map((group, i) => (
          <div key={group.id}>
            {i > 0 && <div className="mb-5 h-px bg-canvas" />}

            <p className="mb-2.5 pb-2 text-sm font-medium text-neutral-800">
              {group.title}
            </p>

            <div className="flex flex-col gap-1.5">
              {group.options.map((option) => {
                const isChecked = selected.has(option.id);

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggle(option.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                      isChecked
                        ? "border-accent bg-surface"
                        : "border-transparent hover:bg-canvas"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                        isChecked
                          ? "border-accent bg-accent"
                          : "border-line bg-white"
                      }`}
                    >
                      {isChecked && (
                        <svg
                          width="10"
                          height="8"
                          viewBox="0 0 10 8"
                          fill="none"
                          className="flex-shrink-0"
                        >
                          <path
                            d="M1 4L3.5 6.5L9 1"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>

                    <span
                      className={`text-sm ${
                        isChecked
                          ? "font-medium text-ink"
                          : "text-neutral-700"
                      }`}
                    >
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full md:w-fit">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="mb-3 flex w-full items-center justify-between rounded-lg border border-line bg-white px-6 py-4 md:hidden"
      >
        <span className="text-sm font-medium text-neutral-800">Filtros</span>

        <div className="flex items-center gap-2">
          <span className="rounded-control bg-accent px-2 py-0.5 text-xs font-medium text-white">
            {selected.size}
          </span>

          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={`text-neutral-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      <div className="hidden md:block">{filterContent}</div>

      <div className={`md:hidden ${isOpen ? "block" : "hidden"}`}>
        {filterContent}
      </div>
    </div>
  );
}
