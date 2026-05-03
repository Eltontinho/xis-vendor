"use client";

import { useEffect, useState } from "react";

type Lot = {
  name: "PLATINUM" | "SILVER" | "BLACK";
  price: string;
  installment: string;
  percent: string;
  total: number;
  remaining: number;
};

export default function FounderCards({
  city,
  onSelect,
}: {
  city: string;
  onSelect: (plan: string) => void;
}) {
  const [lots, setLots] = useState<Lot[]>([]);

  useEffect(() => {
    fetch(`/api/lot-availability?city=${city}`)
      .then((res) => res.json())
      .then((data) => setLots(data))
      .catch(() => {
        // fallback padrão
        setLots([
          {
            name: "PLATINUM",
            price: "R$397/ano",
            installment: "6x R$66,17",
            percent: "94%",
            total: 100,
            remaining: 32,
          },
          {
            name: "SILVER",
            price: "R$347/ano",
            installment: "6x R$57,83",
            percent: "92%",
            total: 200,
            remaining: 78,
          },
          {
            name: "BLACK",
            price: "R$297/ano",
            installment: "6x R$49,50",
            percent: "90%",
            total: 300,
            remaining: 140,
          },
        ]);
      });
  }, [city]);

  return (
    <div className="grid md:grid-cols-3 gap-4 mt-4">
      {lots.map((lot) => (
        <div
          key={lot.name}
          className="rounded-2xl border p-4 shadow-sm hover:shadow-md transition cursor-pointer"
          onClick={() => onSelect(lot.name)}
        >
          <div className="text-sm opacity-60">{lot.name}</div>

          <div className="text-2xl font-bold mt-1">
            {lot.percent} para você
          </div>

          <div className="mt-2 text-sm">
            {lot.price}
            <br />
            <span className="opacity-70">{lot.installment}</span>
          </div>

          <div className="mt-3 text-xs text-orange-500">
            {lot.remaining} vagas restantes
          </div>

          <div className="mt-4 bg-black text-white text-center py-2 rounded-xl text-sm">
            Escolher
          </div>
        </div>
      ))}
    </div>
  );
}