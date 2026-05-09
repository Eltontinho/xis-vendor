"use client";

import { useEffect, useState } from "react";

type Lot = {
  name: "PLATINA" | "OURO" | "PRATA";
  price: number;
  installment: string;
  percent: number;
  total: number;
  reserved: number;
};

interface Props {
  city?: string;
  onSelect?: (lot: Lot) => void;
}

export default function FounderCards({ city, onSelect }: Props) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLots() {
      try {
        const res = await fetch(`/api/lot-availability?city=${city || ""}`);
        const data = await res.json();

        setLots([
          {
            name: "PLATINA",
            price: 397,
            installment: "6x R$66,17",
            percent: 94,
            total: data?.platina?.total ?? 100,
            reserved: data?.platina?.reserved ?? 0,
          },
          {
            name: "OURO",
            price: 347,
            installment: "6x R$57,83",
            percent: 92,
            total: data?.ouro?.total ?? 200,
            reserved: data?.ouro?.reserved ?? 0,
          },
          {
            name: "PRATA",
            price: 297,
            installment: "6x R$49,50",
            percent: 90,
            total: data?.prata?.total ?? 300,
            reserved: data?.prata?.reserved ?? 0,
          },
        ]);
      } catch {
        setLots([
          { name: "PLATINA", price: 397, installment: "6x R$66,17", percent: 94, total: 100, reserved: 0 },
          { name: "OURO", price: 347, installment: "6x R$57,83", percent: 92, total: 200, reserved: 0 },
          { name: "PRATA", price: 297, installment: "6x R$49,50", percent: 90, total: 300, reserved: 0 },
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchLots();
  }, [city]);

  function getRemaining(total: number, reserved: number) {
    return Math.max(total - reserved, 0);
  }

  function getColor(name: Lot["name"]) {
    if (name === "PLATINA") return "#E5E4E2";
    if (name === "OURO") return "#C8A44A";
    return "#C0C0C0";
  }

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        Carregando vagas...
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 16,
        marginTop: 16,
      }}
    >
      {lots.map((lot) => {
        const remaining = getRemaining(lot.total, lot.reserved);

        return (
          <div
            key={lot.name}
            onClick={() => onSelect?.(lot)}
            style={{
              borderRadius: 16,
              padding: 20,
              cursor: "pointer",
              background: "#1a1a1a",
              color: "#fff",
              border: `2px solid ${getColor(lot.name)}`,
              transition: "0.2s",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {lot.name}
            </div>

            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
              {lot.percent}% por corrida
            </div>

            <div style={{ marginTop: 12, fontSize: 24, fontWeight: 700 }}>
              R${lot.price}
            </div>

            <div style={{ fontSize: 13, opacity: 0.7 }}>
              {lot.installment}
            </div>

            <div style={{ marginTop: 12, fontSize: 13 }}>
              {remaining} vagas restantes
            </div>

            <div
              style={{
                marginTop: 10,
                height: 6,
                borderRadius: 4,
                background: "#333",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(remaining / lot.total) * 100}%`,
                  height: "100%",
                  background: getColor(lot.name),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}