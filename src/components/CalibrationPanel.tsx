import { useState } from 'react';
import { Hand } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Choice } from './Controls';
import type {
  CalibrationSide,
  CalibrationState,
} from '../gestures/ExpansionCalibration';
import type { HandControlState } from '../types';
export function CalibrationPanel({
  state,
  hands,
  enabled,
  onBegin,
  onCapture,
  onCancel,
  onReset,
}: {
  state: CalibrationState;
  hands: HandControlState[];
  enabled: boolean;
  onBegin: (side: CalibrationSide) => void;
  onCapture: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const [side, setSide] = useState<CalibrationSide>('left');
  const hand = hands.find(
    (h) => h.handedness === (state.step === 'idle' ? side : state.side),
  );
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogTrigger className="text-button calibration-trigger">
        <Hand size={16} />
        Calibrate hand openness
      </DialogTrigger>
      <DialogContent className="duo-dialog calibration-dialog">
        <DialogTitle>A comfortable range</DialogTitle>
        <DialogDescription>
          Relax your hand, then open it comfortably. We’ll use your own range
          for sustain and reverb. Show only the chosen hand while calibrating.
        </DialogDescription>
        <Choice
          label="Calibration hand"
          value={side}
          disabled={state.step !== 'idle'}
          options={[
            { value: 'left', label: 'Left hand' },
            { value: 'right', label: 'Right hand' },
          ]}
          onChange={(s) => setSide(s as CalibrationSide)}
        />
        <div className="calibration-reading">
          <span>{hand ? 'Hand detected' : 'Waiting for this hand'}</span>
          <strong>
            {hand ? `${Math.round(hand.handExpansion * 100)}%` : '—'}
          </strong>
        </div>
        <output className="muted">
          {enabled
            ? state.message
            : 'Start the live camera to calibrate. Comfortable default bounds are already active.'}
        </output>
        {state.step === 'idle' ? (
          <button
            className="button primary"
            disabled={!enabled}
            onClick={() => onBegin(side)}
          >
            Start calibration
          </button>
        ) : (
          <>
            <span className="calibration-step">
              {state.step === 'closed'
                ? '1 / 2 · Relax or close naturally'
                : '2 / 2 · Open comfortably'}
            </span>
            <button
              className="button primary"
              disabled={!hand}
              onClick={onCapture}
            >
              {state.step === 'closed'
                ? 'Capture relaxed hand'
                : 'Capture open hand'}
            </button>
            <button className="text-button" onClick={onCancel}>
              Cancel calibration
            </button>
          </>
        )}
        <div className="calibration-footer">
          <span>
            {state.calibrated.length
              ? `Saved: ${state.calibrated.join(' + ')}`
              : 'Using default bounds'}
          </span>
          <button className="text-button" onClick={onReset}>
            Reset calibration
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
