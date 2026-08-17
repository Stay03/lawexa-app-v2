'use client';

import { useState } from 'react';
import { PanelTop, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BAR_DEFAULTS,
  SHIPPED_TREATMENT,
  readBarTuning,
  writeBarTuning,
  type BarTreatment,
  type BarTuning,
} from '@/v2/bar-tuning';

/**
 * The top bar's treatment, adjustable on the phone it is being judged on.
 *
 * The owner asked for this on 17 August 2026, after two days of not deciding
 * between the blur and the fade: "add it there, and any other kind of settings
 * you think I'll need to play with on that particular header thing before I
 * decide", then "maybe something like opacity level, blur level".
 *
 * ── IT IS A THINKING TOOL AND IT IS MEANT TO BE DELETED ────────────────────
 * Once he picks, the winning numbers become the defaults in `shell.css` and
 * this card, the store behind it and the losing treatment all come out
 * together. It is written to be easy to remove: one file, one import in
 * `DeveloperSettings`, and a store that already answers with the shipped values
 * when it is empty.
 *
 * ── THE SLIDERS ARE NATIVE, ON PURPOSE ─────────────────────────────────────
 * There is no slider in `components/ui`, and adding one — with its own wrapper,
 * its own tokens and its own dark-mode pass — to serve a control that is
 * expected to be deleted would leave more behind than it removes. A native
 * `range` is keyboard-operable and screen-reader-labelled without any of that.
 * If a slider is ever wanted in the product proper, that is the moment to build
 * the primitive properly.
 */
export function BarTuningControls() {
  // Lazy initialiser, the idiom this card already uses: read the stored value
  // once on mount rather than in an effect, and guard for SSR.
  const [tuning, setTuning] = useState<BarTuning>(() => readBarTuning());

  const apply = (next: BarTuning) => {
    setTuning(next);
    writeBarTuning(next);
  };

  /** Changing the treatment brings ITS defaults with it, so moving from blur to
   *  fade does not carry the blur's 12% tint onto a rule that wants 22%. */
  const pickTreatment = (value: string) => {
    const treatment = value as BarTreatment;
    apply(BAR_DEFAULTS[treatment]);
  };

  const reset = () => {
    setTuning(BAR_DEFAULTS[SHIPPED_TREATMENT]);
    writeBarTuning(null);
  };

  const isDefault =
    tuning.treatment === SHIPPED_TREATMENT &&
    tuning.blur === BAR_DEFAULTS[SHIPPED_TREATMENT].blur &&
    tuning.tint === BAR_DEFAULTS[SHIPPED_TREATMENT].tint;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="v2-bar-treatment" className="flex items-center gap-2">
            <PanelTop className="h-4 w-4" />
            Top bar treatment
          </Label>
          <p className="text-sm text-muted-foreground">
            What the see-through bar paints behind itself as the page scrolls
            under it. Changes apply to v2 immediately, on this browser only.
          </p>
        </div>
        <Select value={tuning.treatment} onValueChange={pickTreatment}>
          <SelectTrigger id="v2-bar-treatment" className="w-32 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="blur">Blur</SelectItem>
            <SelectItem value="fade">Fade</SelectItem>
            <SelectItem value="none">Nothing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tuning.treatment === 'blur' ? (
        <Range
          id="v2-bar-blur"
          label="Blur strength"
          hint="How far the text behind the bar is smeared. 1.5 is what ships."
          min={0}
          max={12}
          step={0.5}
          value={tuning.blur}
          format={(v) => `${v}px`}
          onChange={(blur) => apply({ ...tuning, blur })}
        />
      ) : null}

      {tuning.treatment === 'none' ? null : (
        <Range
          id="v2-bar-tint"
          label="Tint strength"
          hint="How much of the page colour sits over the strip. Higher hides more of what is under it."
          min={0}
          max={100}
          step={1}
          value={tuning.tint}
          format={(v) => `${v}%`}
          onChange={(tint) => apply({ ...tuning, tint })}
        />
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={reset}
        disabled={isDefault}
        className="gap-2"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {isDefault ? 'Showing what ships' : 'Put it back to what ships'}
      </Button>
    </div>
  );
}

/** One labelled number, with its current value stated — a slider whose value is
 *  invisible is a slider nobody can report back to me about. */
function Range({
  id,
  label,
  hint,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {format(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-6 w-full accent-primary"
      />
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
