import React, { useState, useEffect } from 'react';
import {
  Clock,
  User,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Scissors,
  Phone,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Lock,
  Smartphone,
  Trash2,
  CalendarOff,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://tzhavfujlnmvqyjfyust.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6aGF2ZnVqbG5tdnF5amZ5dXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTkyODYsImV4cCI6MjA4NjM5NTI4Nn0.vLUmkZso96XZt27h_vj_HEhCXYcU0BBIN0UHTrf8MG8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DAYS = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];
const STENCIL_FONT = { fontFamily: "'Impact', 'Arial Black', sans-serif" };

export default function App() {
  const [view, setView] = useState('client');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [adminError, setAdminError] = useState(false);
  const [loading, setLoading] = useState(true);

  const [appointments, setAppointments] = useState([]);
  const [businessHours, setBusinessHours] = useState({});
  const [blockedSlots, setBlockedSlots] = useState([]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingData, setBookingData] = useState({ name: '', snap: '' });
  const [step, setStep] = useState(1);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([
      fetchAppointments(),
      fetchBusinessHours(),
      fetchBlockedSlots(),
    ]);
    setLoading(false);
  };

  const fetchAppointments = async () => {
    const { data } = await supabase.from('appointments').select('*');
    if (data) setAppointments(data);
  };

  const fetchBusinessHours = async () => {
    const { data } = await supabase
      .from('business_hours')
      .select('*')
      .order('day_of_week');
    if (data) {
      const hoursObj = {};
      data.forEach((h) => {
        hoursObj[h.day_of_week] = h;
      });
      setBusinessHours(hoursObj);
    }
  };

  const fetchBlockedSlots = async () => {
    const { data } = await supabase.from('blocked_slots').select('*');
    if (data) setBlockedSlots(data);
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminInput === '1234') {
      setIsAdminAuthenticated(true);
      setAdminError(false);
      setAdminInput('');
    } else {
      setAdminError(true);
      setTimeout(() => setAdminError(false), 2000);
    }
  };

  const shiftTime = (timeStr, minutesToAdd) => {
    if (!timeStr) timeStr = '09:00:00';
    let [h, m] = timeStr.split(':').map(Number);
    let totalMinutes = h * 60 + m + minutesToAdd;
    if (totalMinutes < 0) totalMinutes = 0;
    if (totalMinutes >= 1440) totalMinutes = 1425;
    const newH = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, '0');
    const newM = (totalMinutes % 60).toString().padStart(2, '0');
    return `${newH}:${newM}:00`;
  };

  const updateHours = async (day, field, value) => {
    // Correction ici : on utilise les backticks ` pour que ${value} fonctionne
    const timeValue = value.length === 5 ? `${value}:00` : value;

    const { data, error } = await supabase
      .from('business_hours')
      .update({ [field]: timeValue })
      .eq('day_of_week', day)
      .select(); // On demande de voir si une ligne a vraiment été touchée

    if (error) {
      alert("❌ Erreur Supabase : " + error.message);
    } else if (data && data.length > 0) {
      // Succès : on rafraîchit l'affichage
      fetchBusinessHours();
    } else {
      // Si pas d'erreur mais pas de data, c'est que les RLS bloquent !
      alert("⚠️ Supabase refuse la modif. Vérifie tes RLS sur la table 'business_hours'");
    }
  };  
  const toggleBlockDay = async (dateStr) => {
    const existing = blockedSlots.find(
      (b) => b.specific_date === dateStr && b.all_day
    );
    if (existing) {
      await supabase.from('blocked_slots').delete().eq('id', existing.id);
    } else {
      await supabase
        .from('blocked_slots')
        .insert([
          { specific_date: dateStr, all_day: true, reason: 'Fermeture' },
        ]);
    }
    fetchBlockedSlots();
  };

  const deleteAppointment = async (id) => {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (!error) fetchAppointments();
  };

  // --- GÉNÉRATION CRÉNEAUX CLIENT ---
  const generateSlots = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const hours = businessHours[dayOfWeek];
    const isDayBlocked = blockedSlots.find(
      (b) => b.specific_date === dateStr && b.all_day
    );

    if (!hours || hours.is_closed || isDayBlocked) return [];

    const slots = [];
    const [hOpen, mOpen] = (hours.open_time || '09:00').split(':').map(Number);
    const [hClose, mClose] = (hours.close_time || '19:00')
      .split(':')
      .map(Number);

    let current = new Date(date);
    current.setHours(hOpen, mOpen, 0, 0);
    const end = new Date(date);
    end.setHours(hClose, mClose, 0, 0);

    while (current < end) {
      const timeStr = current.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      slots.push(timeStr);
      current.setMinutes(current.getMinutes() + 30);
    }
    return slots;
  };

  const isSlotAvailable = (timeStr, date) => {
    const dateStr = date.toISOString().split('T')[0];
    return !appointments.some((appt) => {
      const apptDate = appt.start_time.split('T')[0];
      const apptTime = new Date(appt.start_time).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return apptDate === dateStr && apptTime === timeStr;
    });
  };

  const handleBooking = async () => {
    const [h, m] = selectedSlot.split(':').map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(h, m, 0, 0);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30);

    const { error } = await supabase.from('appointments').insert([
      {
        client_name: bookingData.name,
        snapchat_handle: bookingData.snap,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      },
    ]);

    if (!error) {
      setStep(3);
      fetchAppointments();
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white italic">
        F16 BARBER...
      </div>
    );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <nav className="border-b border-zinc-900 bg-zinc-950 p-6 sticky top-0 z-50 flex justify-between items-center">
        <div>
          <h1 style={STENCIL_FONT} className="text-4xl tracking-tighter">
            F16
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-[0.3em]">
            Talant • Urban Cuts
          </p>
        </div>
        <button
          onClick={() => setView(view === 'admin' ? 'client' : 'admin')}
          className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400"
        >
          {view === 'client' ? <Settings size={20} /> : <Scissors size={20} />}
        </button>
      </nav>

      <main className="max-w-md mx-auto p-6 pb-24">
        {view === 'client' ? (
          <div className="space-y-8">
            {step === 1 && (
              <>
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                    const d = new Date();
                    d.setDate(d.getDate() + i);
                    const active =
                      selectedDate.toDateString() === d.toDateString();
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedDate(d);
                          setSelectedSlot(null);
                        }}
                        className={`flex-shrink-0 w-16 h-24 rounded-2xl flex flex-col items-center justify-center border transition-all ${
                          active
                            ? 'bg-white text-black border-white'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                        }`}
                      >
                        <span className="text-[10px] uppercase font-bold">
                          {DAYS[d.getDay()].slice(0, 3)}
                        </span>
                        <span className="text-2xl font-black">
                          {d.getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {generateSlots(selectedDate).length > 0 ? (
                    generateSlots(selectedDate).map((time) => (
                      <button
                        key={time}
                        disabled={!isSlotAvailable(time, selectedDate)}
                        onClick={() => setSelectedSlot(time)}
                        className={`py-4 rounded-xl font-bold text-sm border transition-all ${
                          !isSlotAvailable(time, selectedDate)
                            ? 'opacity-10 grayscale'
                            : selectedSlot === time
                            ? 'bg-white text-black border-white'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {time}
                      </button>
                    ))
                  ) : (
                    <p className="col-span-3 text-center py-10 text-zinc-600 italic">
                      Salon fermé ce jour
                    </p>
                  )}
                </div>
                {selectedSlot && (
                  <button
                    onClick={() => setStep(2)}
                    className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase tracking-widest mt-8"
                  >
                    Réserver {selectedSlot}
                  </button>
                )}
              </>
            )}
            {step === 2 && (
              <div className="space-y-6">
                <button
                  onClick={() => setStep(1)}
                  className="text-zinc-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2"
                >
                  <ChevronLeft size={16} /> Retour
                </button>
                <h2 style={STENCIL_FONT} className="text-3xl uppercase">
                  Infos Client
                </h2>
                <input
                  type="text"
                  placeholder="Nom Complet"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:border-white outline-none"
                  onChange={(e) =>
                    setBookingData({ ...bookingData, name: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Snapchat (@)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 focus:border-white outline-none"
                  onChange={(e) =>
                    setBookingData({ ...bookingData, snap: e.target.value })
                  }
                />
                <button
                  onClick={handleBooking}
                  className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase"
                >
                  Confirmer
                </button>
              </div>
            )}
            {step === 3 && (
              <div className="text-center py-20 space-y-4">
                <CheckCircle2
                  size={64}
                  className="mx-auto text-white animate-bounce"
                />
                <h2 style={STENCIL_FONT} className="text-4xl">
                  CONFIRMÉ !
                </h2>
                <button
                  onClick={() => setStep(1)}
                  className="pt-8 text-zinc-400 underline uppercase text-xs tracking-widest"
                >
                  Retour
                </button>
              </div>
            )}
          </div>
        ) : (
          /* VUE ADMIN */
          <div className="space-y-10">
            {!isAdminAuthenticated ? (
              <form
                onSubmit={handleAdminLogin}
                className="flex flex-col items-center gap-6 py-20"
              >
                <Lock size={48} className="text-zinc-800" />
                <input
                  type="password"
                  placeholder="CODE PIN"
                  className={`bg-zinc-900 border-2 rounded-2xl p-4 text-center text-2xl w-48 focus:outline-none ${
                    adminError
                      ? 'border-red-500'
                      : 'border-zinc-800 focus:border-white'
                  }`}
                  value={adminInput}
                  onChange={(e) => setAdminInput(e.target.value)}
                />
                <button className="bg-white text-black px-8 py-3 rounded-xl font-bold uppercase text-sm">
                  Entrer
                </button>
              </form>
            ) : (
              <div className="space-y-10 animate-in fade-in duration-500">
                <h2
                  style={STENCIL_FONT}
                  className="text-3xl flex items-center gap-3"
                >
                  <ShieldCheck className="text-green-500" /> PANEL F16
                </h2>

                {/* RÉGLAGES HORAIRES */}
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Clock size={14} /> Horaires de travail
                  </h3>
                  {DAYS.map((dayName, index) => {
                    const h = businessHours[index];
                    if (!h) return null;
                    return (
                      <div
                        key={index}
                        className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm">{dayName}</span>
                          <button
                            onClick={() =>
                              updateHours(index, 'is_closed', !h.is_closed)
                            }
                            className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase ${
                              h.is_closed
                                ? 'bg-red-900/20 text-red-500'
                                : 'bg-green-900/20 text-green-500'
                            }`}
                          >
                            {h.is_closed ? 'Fermé' : 'Ouvert'}
                          </button>
                        </div>
                        {!h.is_closed && (
                          <div className="space-y-3 pt-2">
                            {/* BOUTONS OUVERTURE */}
                            <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                              <span className="text-[10px] uppercase text-zinc-500 font-bold pl-2">
                                Ouverture
                              </span>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateHours(
                                      index,
                                      'open_time',
                                      shiftTime(h.open_time, -30)
                                    )
                                  }
                                  className="w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 text-white font-bold text-xl active:scale-90"
                                >
                                  -
                                </button>
                                <span className="text-sm font-mono font-bold w-12 text-center text-white">
                                  {h.open_time?.slice(0, 5)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateHours(
                                      index,
                                      'open_time',
                                      shiftTime(h.open_time, 30)
                                    )
                                  }
                                  className="w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 text-white font-bold text-xl active:scale-90"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* BOUTONS FERMETURE */}
                            <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                              <span className="text-[10px] uppercase text-zinc-500 font-bold pl-2">
                                Fermeture
                              </span>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateHours(
                                      index,
                                      'close_time',
                                      shiftTime(h.close_time, -30)
                                    )
                                  }
                                  className="w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 text-white font-bold text-xl active:scale-90"
                                >
                                  -
                                </button>
                                <span className="text-sm font-mono font-bold w-12 text-center text-white">
                                  {h.close_time?.slice(0, 5)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateHours(
                                      index,
                                      'close_time',
                                      shiftTime(h.close_time, 30)
                                    )
                                  }
                                  className="w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 text-white font-bold text-xl active:scale-90"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>

                {/* FERMETURES EXCEPTIONNELLES */}
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <CalendarOff size={14} /> Bloquer un jour (Vacances)
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      id="block-date"
                      className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm w-full"
                    />
                    <button
                      onClick={() =>
                        toggleBlockDay(
                          document.getElementById('block-date').value
                        )
                      }
                      className="bg-white text-black px-4 rounded-xl font-bold text-sm"
                    >
                      Bloquer
                    </button>
                  </div>
                  <div className="space-y-2">
                    {blockedSlots.map((b) => (
                      <div
                        key={b.id}
                        className="bg-red-950/10 border border-red-900/30 p-3 rounded-xl flex justify-between items-center"
                      >
                        <span className="text-xs text-red-200">
                          Fermé le{' '}
                          {new Date(b.specific_date).toLocaleDateString(
                            'fr-FR'
                          )}
                        </span>
                        <button
                          onClick={() => toggleBlockDay(b.specific_date)}
                          className="text-red-500"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* RDV À VENIR */}
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <User size={14} /> Clients à venir
                  </h3>
                  {appointments
                    .sort(
                      (a, b) => new Date(a.start_time) - new Date(b.start_time)
                    )
                    .map((appt) => (
                      <div
                        key={appt.id}
                        className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-white uppercase text-sm">
                            {appt.client_name}
                          </p>
                          <p className="text-[10px] text-zinc-500 uppercase">
                            {new Date(appt.start_time).toLocaleString('fr-FR', {
                              weekday: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          <p className="text-[10px] text-yellow-500">
                            Snap: {appt.snapchat_handle}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteAppointment(appt.id)}
                          className="text-zinc-700 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                </section>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-10 text-center border-t border-zinc-900 mt-12">
        <p className="text-zinc-700 text-[10px] tracking-[0.5em] uppercase">
          © 2026 F16 BARBER • TALANT
        </p>
      </footer>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
