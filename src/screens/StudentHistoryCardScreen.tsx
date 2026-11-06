import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { getDatabase } from '../database/connection';
import { StudentRepository } from '../repositories/StudentRepository';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { Student, ParentGuardian, AttendanceStatus } from '../models/types';

// Card palette: deep Silambam green, turmeric gold and temple-stone cream.
const GREEN = '#0F4D2E';
const GREEN_SOFT = '#1D6B43';
const GOLD = '#E0A526';
const CREAM = '#FBF7EC';
const INK = '#14321F';
const MUTED = '#5B6B5F';

const MARKS: Record<AttendanceStatus, { symbol: string; label: string; bg: string; fg: string }> = {
  PRESENT: { symbol: '✓', label: 'Present', bg: '#D9F2E3', fg: '#14532D' },
  LATE: { symbol: 'L', label: 'Late', bg: '#FCE9B0', fg: '#78350F' },
  ABSENT: { symbol: '✗', label: 'Absent', bg: '#FDE2E7', fg: '#9F1239' },
  LEAVE: { symbol: 'V', label: 'Leave', bg: '#E4E8F0', fg: '#334155' },
};

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_TA = ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'];

const pad = (n: number) => String(n).padStart(2, '0');

// Parses a YYYY-MM-DD string as a local date (new Date(string) would read it as UTC).
function parseIso(value?: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isoOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function displayDate(value?: string | null): string {
  const date = parseIso(value);
  return date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` : '—';
}

function ageOn(dob: string | null | undefined, on: Date): number | null {
  const born = parseIso(dob);
  if (!born) return null;
  let age = on.getFullYear() - born.getFullYear();
  const beforeBirthday =
    on.getMonth() < born.getMonth() || (on.getMonth() === born.getMonth() && on.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

// Saturdays and Sundays of one month, in order.
function weekendDates(year: number, month: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date(year, month, 1);
  while (cursor.getMonth() === month) {
    if (cursor.getDay() === 0 || cursor.getDay() === 6) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

interface CellProps {
  date: Date;
  status: AttendanceStatus | null;
  active: boolean; // on or after joining, and not in the future
}

const DayCell: React.FC<CellProps> = ({ date, status, active }) => {
  const mark = status ? MARKS[status] : null;
  return (
    <View style={styles.dayRow}>
      <Text style={styles.dayNumber}>{pad(date.getDate())}</Text>
      <View
        style={[
          styles.dayMark,
          mark ? { backgroundColor: mark.bg } : active ? styles.dayMarkEmpty : styles.dayMarkOff,
        ]}
        accessibilityLabel={
          mark ? `${pad(date.getDate())} ${mark.label}` : active ? `${pad(date.getDate())} no record` : `${pad(date.getDate())} not counted`
        }
      >
        <Text style={[styles.dayMarkText, mark ? { color: mark.fg } : styles.dayMarkTextMuted]}>
          {mark ? mark.symbol : active ? '–' : ''}
        </Text>
      </View>
    </View>
  );
};

export default function StudentHistoryCardScreen({ route, navigation }: any) {
  const studentId: string = route?.params?.studentId;
  const [student, setStudent] = useState<Student | null>(null);
  const [guardian, setGuardian] = useState<ParentGuardian | null>(null);
  const [centerName, setCenterName] = useState<{ en: string; ta: string }>({ en: 'Vagai Silambam', ta: 'வாகை சிலம்பம்' });
  const [rate, setRate] = useState(0);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stu = await StudentRepository.getStudentById(studentId);
        if (!stu || cancelled) return;
        const [guardians, attendance, rateValue] = await Promise.all([
          StudentRepository.getStudentGuardians(stu.id),
          AttendanceRepository.getAttendanceHistory({ studentId: stu.id }, 5000),
          StudentRepository.getStudentAttendanceRate(stu.id),
        ]);
        const db = await getDatabase();
        const center = await db.getFirstAsync<{ name_en: string; name_ta: string }>(
          'SELECT name_en, name_ta FROM training_centers WHERE id = ?',
          stu.training_center_id
        );

        const byDate: Record<string, AttendanceStatus> = {};
        for (const row of attendance) {
          const day = String(row.session_date).slice(0, 10);
          if (!byDate[day]) byDate[day] = row.status as AttendanceStatus;
        }

        if (cancelled) return;
        setStudent(stu);
        setGuardian(guardians[0] ?? null);
        setRecords(byDate);
        setRate(rateValue);
        if (center) setCenterName({ en: center.name_en, ta: center.name_ta });
      } catch (err) {
        console.warn('History card load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const totals = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = { PRESENT: 0, LATE: 0, ABSENT: 0, LEAVE: 0 };
    Object.entries(records).forEach(([day, status]) => {
      const date = parseIso(day);
      if (date && date.getFullYear() === year) counts[status] += 1;
    });
    return counts;
  }, [records, year]);

  if (!student) {
    return (
      <View style={styles.screen}>
        <TopBar title="History card" onBack={() => navigation.goBack()} />
        <Text style={styles.notice}>{loading ? 'Loading…' : 'Student not found.'}</Text>
      </View>
    );
  }

  const today = new Date();
  const todayIso = isoOf(today);
  const joined = isoOf(parseIso(student.joining_date) ?? new Date(0));
  const age = ageOn(student.date_of_birth, today);
  const initial = student.name_en ? student.name_en.charAt(0).toUpperCase() : 'S';

  return (
    <View style={styles.screen}>
      <TopBar title="History card" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card} accessibilityRole="summary">
          {/* Header */}
          <View style={styles.header}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            <View style={styles.headerText}>
              <Text style={styles.centerTa}>{centerName.ta}</Text>
              <Text style={styles.centerEn}>{centerName.en}</Text>
            </View>
          </View>
          <View style={styles.titleBand}>
            <Text style={styles.titleTa}>மாணவர் வரலாற்று அட்டை</Text>
            <Text style={styles.titleEn}>Student history card</Text>
          </View>
          <Text style={styles.tagline}>பாரம்பரியம் • ஒழுக்கம் • வீரம்</Text>

          {/* Profile */}
          <View style={styles.panel}>
            <View style={styles.profileRow}>
              <View style={styles.photoFrame}>
                {student.photo_url ? (
                  <Image source={{ uri: student.photo_url }} style={styles.photo} />
                ) : (
                  <View style={styles.photoFallback}>
                    <Text style={styles.photoInitial}>{initial}</Text>
                  </View>
                )}
              </View>
              <View style={styles.details}>
                <Field labelTa="பெயர்" labelEn="Name" value={student.name_en} />
                {!!student.name_ta && <Field labelTa="பெயர் (தமிழ்)" labelEn="Name (Tamil)" value={student.name_ta} />}
                <Field labelTa="பிறந்த தேதி" labelEn="Date of birth" value={displayDate(student.date_of_birth)} />
                <Field labelTa="வயது" labelEn="Age" value={age !== null ? `${age}` : '—'} />
                <Field labelTa="தொலைபேசி" labelEn="Phone" value={student.contact_number || '—'} />
                <Field labelTa="சேர்ந்த தேதி" labelEn="Joined" value={displayDate(student.joining_date)} />
                <Field labelTa="நிலை" labelEn="Level" value={student.training_level || '—'} />
                <Field labelTa="அடையாள எண்" labelEn="Student ID" value={student.student_id} />
              </View>
            </View>

            <View style={styles.block}>
              <Text style={styles.blockLabel}>முகவரி · Address</Text>
              <Text style={styles.blockValue}>{student.address_ta || student.address_en || '—'}</Text>
            </View>
            <View style={styles.block}>
              <Text style={styles.blockLabel}>பாதுகாவலர் · Guardian</Text>
              <Text style={styles.blockValue}>
                {guardian ? `${guardian.name_en}${guardian.relationship ? ` (${guardian.relationship})` : ''} · ${guardian.phone}` : '—'}
              </Text>
            </View>
          </View>

          {/* Attendance */}
          <View style={styles.attHead}>
            <View style={styles.attHeadText}>
              <Text style={styles.attTitleTa}>வருகைப் பதிவு</Text>
              <Text style={styles.attTitleEn}>Attendance · Saturdays and Sundays</Text>
            </View>
            <View style={styles.yearStepper}>
              <TouchableOpacity onPress={() => setYear(year - 1)} style={styles.stepBtn} accessibilityLabel="Previous year">
                <ChevronLeft size={18} color={CREAM} />
              </TouchableOpacity>
              <Text style={styles.yearText}>{year}</Text>
              <TouchableOpacity
                onPress={() => setYear(year + 1)}
                style={styles.stepBtn}
                disabled={year >= today.getFullYear()}
                accessibilityLabel="Next year"
              >
                <ChevronRight size={18} color={year >= today.getFullYear() ? GREEN_SOFT : CREAM} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <Summary symbol="✓" label="Present" value={totals.PRESENT} tone={MARKS.PRESENT} />
            <Summary symbol="L" label="Late" value={totals.LATE} tone={MARKS.LATE} />
            <Summary symbol="✗" label="Absent" value={totals.ABSENT} tone={MARKS.ABSENT} />
            <Summary symbol="V" label="Leave" value={totals.LEAVE} tone={MARKS.LEAVE} />
          </View>
          <Text style={styles.rateText}>Overall attendance {rate}%</Text>

          <View style={styles.monthGrid}>
            {Array.from({ length: 12 }, (_, month) => {
              const days = weekendDates(year, month);
              const saturdays = days.filter(d => d.getDay() === 6);
              const sundays = days.filter(d => d.getDay() === 0);
              return (
                <View key={month} style={styles.monthBox}>
                  <Text style={styles.monthTa}>{MONTHS_TA[month]}</Text>
                  <Text style={styles.monthEn}>{MONTHS_EN[month]}</Text>
                  <View style={styles.monthCols}>
                    <View style={styles.monthCol}>
                      <Text style={styles.colHead}>Sat</Text>
                      {saturdays.map(d => (
                        <DayCell key={isoOf(d)} date={d} status={records[isoOf(d)] ?? null} active={isActive(isoOf(d), joined, todayIso)} />
                      ))}
                    </View>
                    <View style={styles.monthCol}>
                      <Text style={styles.colHead}>Sun</Text>
                      {sundays.map(d => (
                        <DayCell key={isoOf(d)} date={d} status={records[isoOf(d)] ?? null} active={isActive(isoOf(d), joined, todayIso)} />
                      ))}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.legend}>
            ✓ Present · L Late · ✗ Absent · V Leave · – no record · blank = before joining or not yet
          </Text>

          <View style={styles.footer}>
            <Text style={styles.footerTa}>சிலம்பம் தமிழன் பெருமை</Text>
            <Text style={styles.footerEn}>Silambam, the pride of Tamils</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// A date counts only from the joining day up to today.
function isActive(day: string, joined: string, today: string): boolean {
  return day >= joined && day <= today;
}

const Field: React.FC<{ labelTa: string; labelEn: string; value: string }> = ({ labelTa, labelEn, value }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>
      {labelTa} <Text style={styles.fieldLabelEn}>· {labelEn}</Text>
    </Text>
    <Text style={styles.fieldValue}>{value}</Text>
  </View>
);

const Summary: React.FC<{ symbol: string; label: string; value: number; tone: { bg: string; fg: string } }> = ({
  symbol,
  label,
  value,
  tone,
}) => (
  <View style={[styles.summaryChip, { backgroundColor: tone.bg }]}>
    <Text style={[styles.summarySymbol, { color: tone.fg }]}>{symbol}</Text>
    <Text style={[styles.summaryValue, { color: tone.fg }]}>{value}</Text>
    <Text style={[styles.summaryLabel, { color: tone.fg }]}>{label}</Text>
  </View>
);

const TopBar: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
  <View style={styles.topBar}>
    <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
      <ArrowLeft size={22} color={GREEN} />
    </TouchableOpacity>
    <Text style={styles.topTitle}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#E9EFEA' },
  notice: { padding: 24, textAlign: 'center', color: MUTED },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '700', color: INK, marginLeft: 4 },
  scroll: { padding: 12, paddingBottom: 40 },

  card: {
    backgroundColor: GREEN,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: GOLD,
    padding: 12,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  logo: { width: 56, height: 56, borderRadius: 12 },
  headerText: { flex: 1 },
  centerTa: { color: GOLD, fontSize: 20, fontWeight: '800', lineHeight: 28 },
  centerEn: { color: CREAM, fontSize: 13, marginTop: 2 },
  titleBand: {
    marginTop: 10,
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  titleTa: { color: INK, fontSize: 16, fontWeight: '800' },
  titleEn: { color: INK, fontSize: 12, fontWeight: '600', marginTop: 1 },
  tagline: { color: GOLD, textAlign: 'center', marginTop: 8, fontSize: 13, fontWeight: '700' },

  panel: { marginTop: 10, backgroundColor: CREAM, borderRadius: 12, padding: 10 },
  profileRow: { flexDirection: 'row', gap: 12 },
  photoFrame: {
    width: 104,
    height: 124,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: GOLD,
    overflow: 'hidden',
    backgroundColor: '#E6EFE8',
  },
  photo: { width: '100%', height: '100%' },
  photoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoInitial: { fontSize: 44, fontWeight: '800', color: GREEN },
  details: { flex: 1, gap: 5 },
  field: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D8DED7', paddingBottom: 3 },
  fieldLabel: { fontSize: 11, color: MUTED, fontWeight: '600' },
  fieldLabelEn: { fontSize: 10, color: MUTED, fontWeight: '400' },
  fieldValue: { fontSize: 14, color: INK, fontWeight: '700', marginTop: 1 },

  block: { marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E3D6B0', padding: 8 },
  blockLabel: { fontSize: 11, color: MUTED, fontWeight: '600' },
  blockValue: { fontSize: 13, color: INK, marginTop: 2 },

  attHead: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  attHeadText: { flex: 1 },
  attTitleTa: { color: GOLD, fontSize: 17, fontWeight: '800' },
  attTitleEn: { color: CREAM, fontSize: 11, marginTop: 1 },
  yearStepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  yearText: { color: CREAM, fontSize: 16, fontWeight: '800', minWidth: 48, textAlign: 'center' },

  summaryRow: { marginTop: 10, flexDirection: 'row', gap: 6 },
  summaryChip: { flex: 1, borderRadius: 10, paddingVertical: 6, alignItems: 'center' },
  summarySymbol: { fontSize: 14, fontWeight: '800' },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  summaryLabel: { fontSize: 10, fontWeight: '600' },
  rateText: { color: CREAM, fontSize: 12, marginTop: 6, textAlign: 'right' },

  monthGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  monthBox: {
    width: '48.5%',
    backgroundColor: CREAM,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLD,
    padding: 6,
  },
  monthTa: { color: GREEN, fontSize: 14, fontWeight: '800' },
  monthEn: { color: MUTED, fontSize: 10, marginBottom: 4 },
  monthCols: { flexDirection: 'row', gap: 4 },
  monthCol: { flex: 1, gap: 3 },
  colHead: { fontSize: 9, color: MUTED, fontWeight: '700', textAlign: 'center' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dayNumber: { width: 18, fontSize: 10, color: INK, fontWeight: '600', textAlign: 'right' },
  dayMark: { flex: 1, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  dayMarkEmpty: { borderWidth: 1, borderColor: '#B8C4BA', backgroundColor: '#FFFFFF' },
  dayMarkOff: { backgroundColor: 'transparent' },
  dayMarkText: { fontSize: 11, fontWeight: '800' },
  dayMarkTextMuted: { color: MUTED },

  legend: { color: CREAM, fontSize: 11, marginTop: 10, textAlign: 'center' },
  footer: { marginTop: 14, borderTopWidth: 1, borderTopColor: GOLD, paddingTop: 10, alignItems: 'center' },
  footerTa: { color: GOLD, fontSize: 15, fontWeight: '800' },
  footerEn: { color: CREAM, fontSize: 11, marginTop: 2 },
});
