import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { CalendarEvent } from '../types';
import { formatDate, formatDateTime } from '../lib/utils';
import {
  ChevronLeft, ChevronRight, Plus, X, RefreshCw,
  Calendar as CalIcon, Clock, MapPin, Video, Sun, Moon, Users,
  Briefcase, CheckCircle, AlertTriangle, Ticket,
} from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SOURCE_COLORS: Record<string, string> = {
  event: '#3b82f6', task: '#8b5cf6', milestone: '#f59e0b',
  contract: '#ef4444', leave: '#10b981', ticket: '#ec4899',
};
const SOURCE_LABELS: Record<string, string> = {
  event: 'Event', task: 'Task', milestone: 'Milestone',
  contract: 'Contract End', leave: 'Leave', ticket: 'Ticket Due',
};
const SOURCE_ICONS: Record<string, any> = {
  event: CalIcon, task: Briefcase, milestone: CheckCircle,
  contract: AlertTriangle, leave: Sun, ticket: Ticket,
};

const EVENT_TYPES = ['meeting', 'appointment', 'deadline', 'reminder', 'holiday', 'other'];

export default function Calendar() {
  const [today] = useState(new Date());
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [feed, setFeed] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all');

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', event_type: 'meeting', start_time: '', end_time: '',
    is_all_day: false, location: '', meeting_link: '', color: '#3b82f6',
  });

  useEffect(() => {
    fetchFeed();
  }, [year, month]);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const from = new Date(year, month, 1).toISOString();
      const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const { data } = await dataService.getCalendarFeed({ from, to });
      setFeed(data || []);
    } catch (e) { console.error(e) } finally { setLoading(false); }
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const getEventsForDay = (day: number) => {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    return feed.filter(e => {
      const es = e.start?.split('T')[0];
      const ee = e.end?.split('T')[0];
      if (!es) return false;
      if (e.source === 'leave' && ee) return dateStr >= es && dateStr <= ee;
      return dateStr === es;
    });
  };

  const isToday = (day: number) => {
    const d = new Date();
    return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
  };

  const isSelected = (day: number) => {
    return selectedDay?.getDate() === day && selectedDay?.getMonth() === month && selectedDay?.getFullYear() === year;
  };

  const openCreate = (day?: Date) => {
    const d = day || new Date();
    setForm({
      title: '', description: '', event_type: 'meeting',
      start_time: `${d.toISOString().split('T')[0]}T${String(d.getHours()).padStart(2, '0')}:00`,
      end_time: `${d.toISOString().split('T')[0]}T${String(d.getHours() + 1).padStart(2, '0')}:00`,
      is_all_day: false, location: '', meeting_link: '', color: '#3b82f6',
    });
    setShowModal(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    if (ev.source !== 'event') return;
    setForm({
      title: ev.title, description: ev.description || '',
      event_type: ev.type || 'meeting',
      start_time: ev.start?.slice(0, 16) || '',
      end_time: ev.end?.slice(0, 16) || '',
      is_all_day: ev.allDay || false,
      location: ev.location || '',
      meeting_link: ev.meta?.meeting_link || '',
      color: ev.color || '#3b82f6',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const body = {
      ...form,
      start_time: form.is_all_day ? form.start_time.split('T')[0] : form.start_time,
      end_time: form.is_all_day ? form.start_time.split('T')[0] : (form.end_time || form.start_time),
      event_type: form.event_type,
    };
    if (selectedEvent && selectedEvent.source === 'event') {
      await dataService.updateEvent(selectedEvent.id, body);
    } else {
      await dataService.createEvent(body);
    }
    setShowModal(false);
    setSelectedEvent(null);
    fetchFeed();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    await dataService.deleteEvent(id);
    setSelectedEvent(null);
    fetchFeed();
  };

  const filtered = sourceFilter === 'all' ? feed : feed.filter(e => e.source === sourceFilter);

  const dayEvents = selectedDay ? getEventsForDay(selectedDay.getDate()) : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">Events, tasks, milestones, and more</p>
        </div>
        <div className="flex gap-3">
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="input w-36">
            <option value="all">All Sources</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={fetchFeed} className="btn-secondary btn-icon"><RefreshCw size={16} /></button>
          <button onClick={() => openCreate()} className="btn-primary"><Plus size={18} className="mr-1" /> New Event</button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Calendar Grid */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800 overflow-hidden">
            {/* Month Navigation */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
              <button onClick={prevMonth} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><ChevronLeft size={20} /></button>
              <h2 className="text-lg font-semibold">{MONTHS[month]} {year}</h2>
              <button onClick={nextMonth} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><ChevronRight size={20} /></button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-surface-200 dark:border-surface-700">
              {DAYS.map(d => (
                <div key={d} className="px-2 py-2 text-xs font-medium text-surface-500 text-center">{d}</div>
              ))}
            </div>

            {/* Day Cells */}
            <div className="grid grid-cols-7">
              {/* Previous month fillers */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`prev-${i}`} className="min-h-[90px] bg-surface-50 dark:bg-surface-900/50 p-1.5 border-b border-r border-surface-100 dark:border-surface-700/50">
                  <span className="text-xs text-surface-300">{daysInPrev - firstDay + i + 1}</span>
                </div>
              ))}

              {/* Current month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const events = getEventsForDay(day);
                const shown = sourceFilter === 'all' ? events : events.filter(e => e.source === sourceFilter);
                const maxShow = 3;

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(new Date(year, month, day))}
                    className={`min-h-[90px] p-1.5 border-b border-r border-surface-100 dark:border-surface-700/50 cursor-pointer transition-colors hover:bg-surface-50 dark:hover:bg-surface-700/50 ${isToday(day) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''} ${isSelected(day) ? 'ring-2 ring-primary-500 ring-inset' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${isToday(day) ? 'bg-primary-600 text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-surface-600 dark:text-surface-300'}`}>{day}</span>
                      <button onClick={e => { e.stopPropagation(); openCreate(new Date(year, month, day)); }}
                        className="rounded p-0.5 text-surface-300 hover:text-primary-500 opacity-0 hover:opacity-100 transition-opacity">
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {shown.slice(0, maxShow).map(ev => (
                        <div
                          key={`${ev.source}-${ev.id}`}
                          onClick={e => { e.stopPropagation(); setSelectedEvent(ev); }}
                          className="text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium text-white cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: ev.color || SOURCE_COLORS[ev.source] || '#6b7280' }}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {shown.length > maxShow && (
                        <span className="text-[10px] text-surface-400 font-medium">+{shown.length - maxShow} more</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-80 shrink-0 space-y-4">
          {/* Selected Day */}
          {selectedDay && (
            <div className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{formatDate(selectedDay.toISOString())}</h3>
                <button onClick={() => openCreate(selectedDay)} className="btn-secondary text-xs py-1 px-2"><Plus size={12} className="mr-1" /> Add</button>
              </div>

              {dayEvents.length === 0 ? (
                <p className="text-sm text-surface-400">No events this day</p>
              ) : (
                <div className="space-y-2">
                  {dayEvents.map(ev => {
                    const Icon = SOURCE_ICONS[ev.source] || CalIcon;
                    return (
                      <div key={`${ev.source}-${ev.id}`}
                        onClick={() => setSelectedEvent(ev)}
                        className="flex items-start gap-2 p-2 rounded-lg cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                      >
                        <div className="rounded-full p-1.5 mt-0.5" style={{ backgroundColor: (ev.color || SOURCE_COLORS[ev.source] || '#6b7280') + '20' }}>
                          <Icon size={14} style={{ color: ev.color || SOURCE_COLORS[ev.source] || '#6b7280' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{ev.title}</p>
                          <p className="text-xs text-surface-400">{ev.source === 'event' && ev.start ? formatDateTime(ev.start) : ''}{SOURCE_LABELS[ev.source]}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upcoming (next 5 from today) */}
          <div className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
            <h3 className="font-semibold text-sm mb-3">Upcoming</h3>
            {feed.filter(e => new Date(e.start) >= new Date()).slice(0, 5).length === 0 ? (
              <p className="text-sm text-surface-400">No upcoming events</p>
            ) : (
              <div className="space-y-2">
                {feed.filter(e => new Date(e.start) >= new Date()).slice(0, 5).map(ev => (
                  <div key={`${ev.source}-${ev.id}`}
                    onClick={() => setSelectedEvent(ev)}
                    className="flex items-start gap-2 p-2 rounded-lg cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                  >
                    <div className="w-1 h-full rounded-full shrink-0 mt-0.5" style={{ backgroundColor: ev.color || SOURCE_COLORS[ev.source] }}>
                      <div className="w-1 h-8 rounded-full" style={{ backgroundColor: ev.color || SOURCE_COLORS[ev.source] }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ev.title}</p>
                      <p className="text-xs text-surface-400">{formatDate(ev.start)}{ev.source !== 'event' && <span className="ml-1">· {SOURCE_LABELS[ev.source]}</span>}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Detail / Side Panel Modal */}
      {selectedEvent && selectedEvent.source !== 'event' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedEvent(null)}>
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-5 dark:bg-surface-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-full p-1.5" style={{ backgroundColor: (selectedEvent.color || SOURCE_COLORS[selectedEvent.source]) + '20' }}>
                  {React.createElement(SOURCE_ICONS[selectedEvent.source] || CalIcon, { size: 16, style: { color: selectedEvent.color || SOURCE_COLORS[selectedEvent.source] } })}
                </div>
                <h2 className="text-lg font-semibold">{SOURCE_LABELS[selectedEvent.source]}</h2>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <p className="font-medium mb-2">{selectedEvent.title}</p>
            {selectedEvent.description && <p className="text-sm text-surface-500 mb-3">{selectedEvent.description}</p>}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-surface-500"><CalIcon size={14} />{formatDate(selectedEvent.start)}</div>
              {selectedEvent.meta?.project && <div className="flex items-center gap-2 text-surface-500"><Briefcase size={14} />{selectedEvent.meta.project}</div>}
              {selectedEvent.meta?.assignee && <div className="flex items-center gap-2 text-surface-500"><Users size={14} />{selectedEvent.meta.assignee}</div>}
              {selectedEvent.meta?.customer && <div className="flex items-center gap-2 text-surface-500"><Briefcase size={14} />{selectedEvent.meta.customer}</div>}
            </div>
            <button onClick={() => setSelectedEvent(null)} className="btn-secondary w-full mt-4">Close</button>
          </div>
        </div>
      )}

      {selectedEvent && selectedEvent.source === 'event' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedEvent(null)}>
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-5 dark:bg-surface-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Event Details</h2>
              <button onClick={() => setSelectedEvent(null)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>

            <div className="space-y-3 mb-5">
              <p className="font-medium text-lg">{selectedEvent.title}</p>
              {selectedEvent.description && <p className="text-sm text-surface-500">{selectedEvent.description}</p>}

              {!selectedEvent.allDay && selectedEvent.start && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={14} className="text-surface-400" />
                  <span>{new Date(selectedEvent.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    {selectedEvent.end && ` - ${new Date(selectedEvent.end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <CalIcon size={14} className="text-surface-400" />
                <span>{formatDate(selectedEvent.start)}</span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={14} className="text-surface-400" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.meta?.meeting_link && (
                <div className="flex items-center gap-2 text-sm">
                  <Video size={14} className="text-surface-400" />
                  <a href={selectedEvent.meta.meeting_link} target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">{selectedEvent.meta.meeting_link}</a>
                </div>
              )}
              {selectedEvent.type && (
                <span className="inline-block rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-medium capitalize text-surface-600">{selectedEvent.type}</span>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => openEdit(selectedEvent as CalendarEvent)} className="btn-secondary flex-1 py-2"><EditIcon size={14} className="mr-1" /> Edit</button>
              <button onClick={() => handleDelete(selectedEvent.id)} className="btn-secondary flex-1 py-2 text-red-600 border-red-200 hover:bg-red-50">
                <TrashIcon size={14} className="mr-1" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl p-6 dark:bg-surface-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">{selectedEvent?.source === 'event' ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Title <span className="text-red-500">*</span></label>
                <input type="text" className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Color</label>
                  <div className="flex gap-1.5 items-center h-10">
                    {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280', '#14b8a6'].map(c => (
                      <button key={c} onClick={() => setForm({ ...form, color: c })}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c ? 'border-surface-900 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="allDay" checked={form.is_all_day} onChange={e => setForm({ ...form, is_all_day: e.target.checked })} className="rounded border-surface-300" />
                <label htmlFor="allDay" className="text-sm">All day</label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{form.is_all_day ? 'Date' : 'Start Time'}</label>
                  <input type={form.is_all_day ? 'date' : 'datetime-local'} className="input"
                    value={form.is_all_day ? form.start_time.split('T')[0] : form.start_time}
                    onChange={e => setForm({ ...form, start_time: form.is_all_day ? e.target.value + 'T00:00' : e.target.value })} />
                </div>
                {!form.is_all_day && (
                  <div>
                    <label className="label">End Time</label>
                    <input type="datetime-local" className="input" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                  </div>
                )}
              </div>

              <div>
                <label className="label">Location</label>
                <input type="text" className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Room, address, etc." />
              </div>

              <div>
                <label className="label">Meeting Link</label>
                <input type="url" className="input" value={form.meeting_link} onChange={e => setForm({ ...form, meeting_link: e.target.value })} placeholder="https://meet.google.com/..." />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} className="btn-primary">{selectedEvent?.source === 'event' ? 'Update' : 'Create'} Event</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Need to import these for the edit/delete icons in the details modal
import { Edit2 as EditIcon, Trash2 as TrashIcon } from 'lucide-react';
import React from 'react';
