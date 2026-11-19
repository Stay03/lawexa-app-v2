'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HEARD_ABOUT_OPTIONS, HEARD_ABOUT_OTHER_MAX, heardAboutPayload, heardAboutProblem } from '@/lib/utils/heard-about';
import { phoneProblem, storedPhone } from '@/lib/utils/phone-number';

/**
 * The optional phone number and "How did you hear about us?" (Arthur, 18
 * November 2026; on the "Tell us about yourself" step since his pick B, 19
 * November 2026, thread bbdef040).
 *
 * The step saves without waiting for the answer, so the server's rules are
 * checked here first: `check()` holds Next on a refused answer and shows why.
 * `payload()` carries only what the person typed or chose: a phone left
 * untouched is not sent, so the server keeps what it has.
 */
export function useOnboardingContact(savedPhone: string | null | undefined) {
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [heardAbout, setHeardAbout] = useState<string | null>(null);
  const [heardAboutOther, setHeardAboutOther] = useState('');
  const [heardTouched, setHeardTouched] = useState(false);

  const phoneValue = phone ?? savedPhone ?? '';
  const phoneError = phoneProblem(phoneValue);
  const heardError = heardAboutProblem(heardAbout, heardAboutOther);

  /** True when both answers may be sent; otherwise shows why and returns false. */
  const check = () => {
    if (!phoneError && !heardError) return true;
    setPhoneTouched(true);
    setHeardTouched(true);
    return false;
  };

  const payload = (): Record<string, string> => ({
    ...(phone !== null ? { phone: storedPhone(phone) } : {}),
    ...heardAboutPayload(heardAbout, heardAboutOther),
  });

  const fields = (
    <>
      <div className="space-y-2">
        <Label htmlFor="onboarding-phone">
          Phone number <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="onboarding-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+234 803 123 4567"
          value={phoneValue}
          onChange={(event) => setPhone(event.target.value)}
          onBlur={() => setPhoneTouched(true)}
          aria-invalid={phoneTouched && phoneError !== null}
          aria-describedby={phoneTouched && phoneError ? 'onboarding-phone-error' : undefined}
        />
        {/* No line under it (Arthur: "use none"); only a refusal shows. */}
        {phoneTouched && phoneError ? (
          <p id="onboarding-phone-error" role="alert" className="text-sm text-destructive">
            {phoneError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-heard-about">
          How did you hear about us? <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Select
          value={heardAbout ?? undefined}
          onValueChange={(value) => {
            setHeardAbout(value);
            setHeardTouched(false);
          }}
        >
          <SelectTrigger id="onboarding-heard-about" className="w-full">
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {HEARD_ABOUT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {heardAbout === 'other' ? (
          <Input
            aria-label="Where did you hear about Lawexa?"
            placeholder="Where did you hear about Lawexa?"
            maxLength={HEARD_ABOUT_OTHER_MAX}
            value={heardAboutOther}
            onChange={(event) => setHeardAboutOther(event.target.value)}
            onBlur={() => setHeardTouched(true)}
            aria-invalid={heardTouched && heardError !== null}
            aria-describedby={heardTouched && heardError ? 'onboarding-heard-error' : undefined}
          />
        ) : null}
        {heardTouched && heardError ? (
          <p id="onboarding-heard-error" role="alert" className="text-sm text-destructive">
            {heardError}
          </p>
        ) : null}
      </div>
    </>
  );

  return { fields, check, payload };
}
