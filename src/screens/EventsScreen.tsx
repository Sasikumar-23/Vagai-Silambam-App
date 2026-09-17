import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Calendar, Plus, MapPin, Users, Award, IndianRupee } from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { EventRepository } from '../repositories/EventRepository';
import { EventItem } from '../models/types';

export default function EventsScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const { t, language } = useI18n();
  const { currentRole } = useAuth();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'TOURNAMENT' | 'COMPLETED'>('ALL');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isFocused) {
      loadEvents();
    }
  }, [isFocused, filter]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await EventRepository.getAllEvents(
        filter === 'ALL' || filter === 'TOURNAMENT' ? undefined : filter
      );
      if (filter === 'TOURNAMENT') {
        setEvents(data.filter(e => e.name_en.toLowerCase().includes('championship') || e.name_en.toLowerCase().includes('tournament') || e.name_en.toLowerCase().includes('competition') || e.event_fee > 0));
      } else {
        setEvents(data);
      }
    } catch (e) {
      console.error('Failed to load events:', e);
    } finally {
      setLoading(false);
    }
  };

  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: 'ALL', label: 'All Events' },
    { key: 'TOURNAMENT', label: '🏆 Tournaments' },
    { key: 'OPEN', label: 'Upcoming / Open' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} title={t.events.title} />

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {filterTabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, filter === tab.key && styles.tabBtnActive]}
              onPress={() => setFilter(tab.key)}
            >
              <Text style={[styles.tabBtnText, filter === tab.key && styles.tabBtnTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={events}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.eventCard}
            onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <View style={styles.dateBadge}>
                <Calendar size={14} color={theme.colors.primary} />
                <Text style={styles.dateBadgeText}>{item.event_date}</Text>
              </View>
              <StatusBadge status={item.status} size="small" />
            </View>

            <Text style={styles.eventNameEn}>{item.name_en}</Text>
            {item.name_ta && <Text style={styles.eventNameTa}>{item.name_ta}</Text>}

            <View style={styles.locationRow}>
              <MapPin size={14} color={theme.colors.textMuted} />
              <Text style={styles.locationText} numberOfLines={1}>
                {language === 'ta' && item.location_ta ? item.location_ta : item.location_en}
              </Text>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.feeGroup}>
                <IndianRupee size={14} color={theme.colors.accent} />
                <Text style={styles.feeText}>
                  {item.event_fee > 0 ? `Fee: ₹${item.event_fee}` : 'Free Entry'}
                </Text>
              </View>

              <View style={styles.capacityGroup}>
                <Users size={14} color={theme.colors.textSecondary} />
                <Text style={styles.capacityText}>
                  {item.maximum_participants > 0 ? `Max: ${item.maximum_participants}` : 'Open Capacity'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Calendar size={32} color={theme.colors.primary} />}
              title="No events found"
              subtitle="Create Silambam state tournaments, demonstrations or training camps."
              actionLabel={currentRole === 'ADMIN' ? t.events.createEvent : undefined}
              onAction={() => navigation.navigate('CreateEvent')}
            />
          ) : null
        }
      />

      {/* FAB to Create Event (Admin Only) */}
      {currentRole === 'ADMIN' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateEvent')}
          activeOpacity={0.8}
        >
          <Plus size={26} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: 90,
  },
  eventCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  eventNameEn: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  eventNameTa: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
    marginTop: 2,
    marginBottom: theme.spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  locationText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceSubtle,
  },
  feeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feeText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.accent,
  },
  capacityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  capacityText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
});
