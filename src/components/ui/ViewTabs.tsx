"use client";

import type { KeyboardEvent } from "react";

export function ViewTabs<T extends string>({ label, value, onChange, items }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  items: readonly { id: T; label: string }[];
}) {
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index + items.length - 1) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    onChange(items[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }

  return <div className="fk-tabs" role="tablist" aria-label={label}>
    {items.map((item, index) => <button key={item.id} type="button" role="tab" aria-selected={value === item.id} tabIndex={value === item.id ? 0 : -1} onKeyDown={event => move(event, index)} onClick={() => onChange(item.id)}>{item.label}</button>)}
  </div>;
}
