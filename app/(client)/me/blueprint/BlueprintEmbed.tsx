'use client'

import { useState, type CSSProperties } from 'react'

// One blueprint, already resolved to its public reader URL on the server. The
// `url` is the embed source for the iframe; it's never null here (the page only
// hands embeddable blueprints to this component and falls back to a card when
// blueprintViewUrl() returns null).
export interface EmbeddableBlueprint {
  id: string
  name: string | null
  generatedAt: string | null
  url: string
}

// A compact "Reading · {date}" label for a selector chip, falling back to the
// blueprint name (or a generic label) when there's no usable timestamp.
function chipLabel(b: EmbeddableBlueprint): string {
  if (b.generatedAt) {
    const d = new Date(b.generatedAt)
    if (!Number.isNaN(d.getTime())) {
      return `Reading · ${d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
    }
  }
  return b.name?.trim() || 'Your reading'
}

// Embeds the signed-in client's blueprint reader INLINE, full-width. When the
// client owns more than one blueprint, a small row of theme-aware chips lets
// them swap which reading is embedded (most recent active by default). The book
// inside the iframe keeps its own design — only the wrapper/chips are themed.
//
// All colours come from props, so it stays midnight-safe on every theme. The
// `?embed=1` query is appended by the server (in the `url`) so the reader hides
// its own chrome.
export default function BlueprintEmbed({
  blueprints,
  theme,
  accent,
}: {
  blueprints: EmbeddableBlueprint[]
  theme: { text: string; muted: string }
  accent: string
}) {
  // Default to the first (most recent) blueprint; the list is already newest-first.
  const [selectedId, setSelectedId] = useState(blueprints[0]?.id ?? '')
  const active = blueprints.find(b => b.id === selectedId) ?? blueprints[0]
  if (!active) return null

  const frameWrap: CSSProperties = {
    background: `${accent}0a`,
    border: `1px solid ${accent}26`,
    borderRadius: 16,
    padding: 8,
    overflow: 'hidden',
  }
  const iframeStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '85vh',
    minHeight: 900,
    border: 'none',
    borderRadius: 12,
    background: '#fff',
  }

  return (
    <div className="mt-10">
      {blueprints.length > 1 && (
        <div className="flex flex-wrap gap-2.5 mb-5">
          {blueprints.map(b => {
            const isActive = b.id === active.id
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className="font-label transition-opacity hover:opacity-80"
                style={{
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: `1px solid ${isActive ? accent : `${accent}33`}`,
                  background: isActive ? `${accent}1f` : 'transparent',
                  color: isActive ? theme.text : theme.muted,
                }}
              >
                {chipLabel(b)}
              </button>
            )
          })}
        </div>
      )}

      <div style={frameWrap}>
        <iframe
          key={active.id}
          src={active.url}
          title={active.name?.trim() || 'Your Divine Blueprint'}
          style={iframeStyle}
          loading="lazy"
        />
      </div>
    </div>
  )
}
