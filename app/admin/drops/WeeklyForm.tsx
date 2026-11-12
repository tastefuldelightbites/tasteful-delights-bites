'use client';
import { useActionState } from 'react';
import type { Weekly } from '@/lib/settings';
import { saveWeeklyAction } from '../actions';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function DaySelect({ name, value, label }: { name: string; value: number; label: string }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} className="select" defaultValue={value}>
        {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
      </select>
    </div>
  );
}

export function WeeklyForm({ w }: { w: Weekly }) {
  const [state, action, pending] = useActionState(saveWeeklyAction, null);
  return (
    <details>
      <summary style={{ fontWeight: 700, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Change the weekly schedule</summary>
      <form action={action} className="form-grid" style={{ marginTop: 16 }}>
        <label className="check"><input type="checkbox" name="enabled" defaultChecked={w.enabled} /> Take weekly orders</label>
        <div className="field"><label htmlFor="title">Name customers see</label><input id="title" name="title" className="input" defaultValue={w.title} /></div>
        <div className="form-grid two">
          <DaySelect name="open_day" value={w.open_day} label="Orders open on" />
          <div className="field"><label htmlFor="open_time">at (time)</label><input id="open_time" name="open_time" type="time" className="input" defaultValue={w.open_time} /></div>
          <DaySelect name="close_day" value={w.close_day} label="Orders close on" />
          <div className="field"><label htmlFor="close_time">at (time)</label><input id="close_time" name="close_time" type="time" className="input" defaultValue={w.close_time} /></div>
          <DaySelect name="pickup_day" value={w.pickup_day} label="Pickup day (the one after orders close)" />
          <div className="field"><label htmlFor="pickup_hours">Pickup hours</label><input id="pickup_hours" name="pickup_hours" className="input" defaultValue={w.pickup_hours} /></div>
        </div>
        {state?.ok && <div className="success">Saved! Your weekly schedule is updated.</div>}
        {state?.error && <div className="alert">{state.error}</div>}
        <button className="btn" disabled={pending}>{pending ? 'Saving…' : 'Save Weekly Schedule'}</button>
      </form>
    </details>
  );
}
