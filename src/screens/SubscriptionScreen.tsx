import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Clipboard,
} from 'react-native';
import {
  ShieldCheck,
  Zap,
  AlertTriangle,
  Clock,
  Users,
  Layers,
  Award,
  CheckCircle2,
  Copy,
  RefreshCw,
  Phone,
  Mail,
  ChevronRight,
  Sparkles,
  CreditCard,
  Building2,
  X,
  ExternalLink,
} from 'lucide-react-native';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { api, Plan, SubscriptionInfo } from '../services/ApiClient';
import { StudentRepository } from '../repositories/StudentRepository';

export default function SubscriptionScreen({ navigation }: any) {
  const { t, language } = useI18n();
  const { isOnline } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [localStudentCount, setLocalStudentCount] = useState<number>(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  const loadData = useCallback(async () => {
    try {
      // 1. Get local student count from SQLite
      const count = await StudentRepository.countStudents().catch(() => 0);
      setLocalStudentCount(count);

      // 2. Fetch plans & subscription from API
      const [plansRes, subRes] = await Promise.allSettled([
        api.plans(),
        api.subscription(),
      ]);

      if (plansRes.status === 'fulfilled' && Array.isArray(plansRes.value)) {
        const normalized = plansRes.value.map((p: any) => ({
          id: p.id || p.code?.toLowerCase() || 'starter',
          name: p.name || 'Academy Plan',
          price_monthly: Number(p.price_monthly ?? 0),
          price_yearly: Number(p.price_yearly ?? p.price_annual ?? (p.price_monthly ? p.price_monthly * 10 : 0)),
          max_students: p.max_students ?? 50,
          max_branches: p.max_branches ?? 1,
          max_users: p.max_users ?? 2,
          features: Array.isArray(p.features) && p.features.length ? p.features : [
            `Up to ${p.max_students || 50} students`,
            `${p.max_branches || 1} branch${(p.max_branches || 1) > 1 ? 'es' : ''}`,
            `${p.max_users || 2} admin user${(p.max_users || 1) > 1 ? 's' : ''}`,
            'Offline attendance tracking',
            'Cloud & sync support',
          ],
        }));
        setPlans(normalized);
      } else {
        // Fallback default plans for offline view
        setPlans([
          {
            id: 'starter',
            name: 'Starter Academy',
            price_monthly: 999,
            price_yearly: 9990,
            max_students: 50,
            max_branches: 1,
            max_users: 2,
            features: [
              'Up to 50 active students',
              'Single branch management',
              'Offline-first attendance tracking',
              'Google Sheets permanent sync',
              'Student belt & fee registers',
            ],
          },
          {
            id: 'growth',
            name: 'Pro Academy (Growth)',
            price_monthly: 2499,
            price_yearly: 24990,
            max_students: 250,
            max_branches: 3,
            max_users: 8,
            features: [
              'Up to 250 active students',
              'Up to 3 branches',
              'Full bilingual reports (EN / TA)',
              'Multi-instructor access',
              'Automated fee & grading alerts',
              'Google Drive certificate storage',
            ],
          },
          {
            id: 'enterprise',
            name: 'Federation / Grandmaster',
            price_monthly: 4999,
            price_yearly: 49990,
            max_students: 1000,
            max_branches: 10,
            max_users: 25,
            features: [
              'Up to 1000 students',
              'Up to 10 branches',
              'State & National tournament modules',
              'Priority 24/7 dedicated support',
              'Custom domain & white-label reports',
            ],
          },
        ]);
      }

      if (subRes.status === 'fulfilled' && subRes.value) {
        setSubscription(subRes.value);
      } else {
        // Default representation if offline
        setSubscription({
          plan: {
            id: 'starter',
            name: 'Starter Academy',
            price_monthly: 999,
            price_yearly: 9990,
            max_students: 50,
            max_branches: 1,
            max_users: 2,
            features: ['Up to 50 students', 'Offline attendance', 'Google Sheets backup'],
          },
          status: 'ACTIVE',
          trial_ends_at: null,
          current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
          license_key: 'VS-LIC-TN2026-SAAS',
          organization_code: 'VAGAI-HQ',
          limits: { students: 50, branches: 1, users: 2 },
          usage: { students: count, branches: 1, users: 1 },
        });
      }
    } catch (e: any) {
      console.warn('Subscription fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const copyLicenseKey = (key: string) => {
    Clipboard.setString(key);
    Alert.alert(t.common.success, t.subscription.copied);
  };

  const openUpgradeModal = (plan?: Plan) => {
    setSelectedPlanForUpgrade(plan || plans[1] || null);
    setShowPaymentModal(true);
  };

  // Status badge config
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return { label: t.subscription.active, color: '#059669', bg: '#D1FAE5' };
      case 'TRIAL':
        return { label: t.subscription.trial, color: '#2563EB', bg: '#DBEAFE' };
      case 'EXPIRED':
        return { label: t.subscription.expired, color: '#DC2626', bg: '#FEE2E2' };
      case 'SUSPENDED':
        return { label: t.subscription.suspended, color: '#EA580C', bg: '#FFEDD5' };
      case 'GRACE':
        return { label: t.subscription.grace, color: '#D97706', bg: '#FEF3C7' };
      default:
        return { label: t.subscription.pending, color: '#4B5563', bg: '#F3F4F6' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <AppHeader navigation={navigation} title={t.subscription.title} showBack={true} />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>{t.common.loading}</Text>
        </View>
      </View>
    );
  }

  const badge = getStatusBadge(subscription?.status || 'ACTIVE');
  const studentLimit = subscription?.limits.students || 50;
  const currentStudents = Math.max(subscription?.usage.students || 0, localStudentCount);
  const studentUsagePercent = Math.min(Math.round((currentStudents / studentLimit) * 100), 100);
  const isLimitReached = currentStudents >= studentLimit;
  const isLimitWarning = studentUsagePercent >= 80 && !isLimitReached;

  return (
    <View style={styles.container}>
      <AppHeader
        navigation={navigation}
        title={t.subscription.title}
        subtitle={t.subscription.subtitle}
        showBack={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
      >
        {/* Offline Banner if not online */}
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Clock size={16} color="#B45309" />
            <Text style={styles.offlineBannerText}>
              {language === 'ta'
                ? 'ஆஃப்லைன் முறை — காட்டப்படும் சந்தா விவரங்கள் தற்காலிக சேமிப்பில் உள்ளவை.'
                : 'Offline Mode — Showing cached subscription details.'}
            </Text>
          </View>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 1. CURRENT SUBSCRIPTION HERO CARD                             */}
        {/* ───────────────────────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroSubtitle}>{t.subscription.currentPlan}</Text>
              <Text style={styles.heroTitle}>{subscription?.plan.name || 'Starter Academy'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
              <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>

          {/* Org & License Row */}
          <View style={styles.infoRow}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>{t.subscription.orgCode}</Text>
              <Text style={styles.infoVal}>{subscription?.organization_code || 'VAGAI-ACADEMY'}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>
                {subscription?.status === 'TRIAL' ? t.subscription.trialEnds : t.subscription.renewalDate}
              </Text>
              <Text style={styles.infoVal}>
                {subscription?.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString(
                      language === 'ta' ? 'ta-IN' : 'en-IN',
                      { year: 'numeric', month: 'short', day: 'numeric' }
                    )
                  : '31 Dec 2026'}
              </Text>
            </View>
          </View>

          {/* License Key Box */}
          {subscription?.license_key && (
            <View style={styles.licenseKeyBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.licenseKeyLabel}>{t.subscription.licenseKey}</Text>
                <Text style={styles.licenseKeyValue} numberOfLines={1} ellipsizeMode="middle">
                  {subscription.license_key}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => copyLicenseKey(subscription.license_key)}
                activeOpacity={0.7}
              >
                <Copy size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Action Row */}
          <View style={styles.heroActionRow}>
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => openUpgradeModal()}
              activeOpacity={0.85}
            >
              <Sparkles size={16} color="#FFFFFF" />
              <Text style={styles.upgradeBtnText}>
                {subscription?.status === 'EXPIRED' ? t.subscription.renewPlan : t.subscription.upgradePlan}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.refreshIconBtn} onPress={onRefresh} activeOpacity={0.7}>
              <RefreshCw size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 2. CAPACITY & USAGE LIMITS                                     */}
        {/* ───────────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {language === 'ta' ? 'பயன்பாட்டு வரம்புகள் & ஒதுக்கீடு' : 'Capacity & Usage Limits'}
          </Text>

          {/* Warning Banner if limit reached or approaching */}
          {isLimitReached && (
            <View style={styles.limitAlertBoxDanger}>
              <AlertTriangle size={18} color="#DC2626" />
              <Text style={styles.limitAlertTextDanger}>{t.subscription.limitReached}</Text>
            </View>
          )}
          {isLimitWarning && (
            <View style={styles.limitAlertBoxWarning}>
              <AlertTriangle size={18} color="#D97706" />
              <Text style={styles.limitAlertTextWarning}>{t.subscription.limitWarning}</Text>
            </View>
          )}

          {/* Student Quota Progress */}
          <View style={styles.quotaItem}>
            <View style={styles.quotaHeader}>
              <View style={styles.quotaTitleGroup}>
                <Users size={16} color={theme.colors.primary} />
                <Text style={styles.quotaTitle}>{t.subscription.studentLimit}</Text>
              </View>
              <Text style={styles.quotaNumbers}>
                <Text style={{ fontWeight: '800', color: isLimitReached ? '#DC2626' : theme.colors.textPrimary }}>
                  {currentStudents}
                </Text>{' '}
                / {studentLimit}
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${studentUsagePercent}%`,
                    backgroundColor: isLimitReached
                      ? '#DC2626'
                      : isLimitWarning
                      ? '#F59E0B'
                      : theme.colors.accent,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressNote}>
              {studentUsagePercent}% {t.subscription.usageRatio} ({studentLimit - currentStudents}{' '}
              {language === 'ta' ? 'இடங்கள் மீதம்' : 'slots remaining'})
            </Text>
          </View>

          {/* User / Instructor Limit */}
          <View style={[styles.quotaItem, { marginTop: 14 }]}>
            <View style={styles.quotaHeader}>
              <View style={styles.quotaTitleGroup}>
                <Award size={16} color="#7C3AED" />
                <Text style={styles.quotaTitle}>{t.subscription.userLimit}</Text>
              </View>
              <Text style={styles.quotaNumbers}>
                <Text style={{ fontWeight: '800', color: theme.colors.textPrimary }}>
                  {subscription?.usage.users || 1}
                </Text>{' '}
                / {subscription?.limits.users || 2}
              </Text>
            </View>
          </View>

          {/* Branches Limit */}
          <View style={[styles.quotaItem, { marginTop: 14 }]}>
            <View style={styles.quotaHeader}>
              <View style={styles.quotaTitleGroup}>
                <Building2 size={16} color="#059669" />
                <Text style={styles.quotaTitle}>{t.subscription.branchLimit}</Text>
              </View>
              <Text style={styles.quotaNumbers}>
                <Text style={{ fontWeight: '800', color: theme.colors.textPrimary }}>
                  {subscription?.usage.branches || 1}
                </Text>{' '}
                / {subscription?.limits.branches || 1}
              </Text>
            </View>
          </View>
        </View>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 3. AVAILABLE SAAS PLANS COMPARISON                             */}
        {/* ───────────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.plansHeaderRow}>
            <Text style={styles.sectionTitle}>{t.subscription.availablePlans}</Text>

            {/* Monthly / Yearly Toggle */}
            <View style={styles.billingToggle}>
              <TouchableOpacity
                style={[styles.billingTab, billingCycle === 'monthly' && styles.billingTabActive]}
                onPress={() => setBillingCycle('monthly')}
              >
                <Text style={[styles.billingTabText, billingCycle === 'monthly' && styles.billingTabTextActive]}>
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.billingTab, billingCycle === 'yearly' && styles.billingTabActive]}
                onPress={() => setBillingCycle('yearly')}
              >
                <Text style={[styles.billingTabText, billingCycle === 'yearly' && styles.billingTabTextActive]}>
                  Yearly <Text style={{ fontSize: 9, color: theme.colors.gold }}>(-17%)</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Plan Cards */}
          {plans.map((p) => {
            const isCurrent = (subscription?.plan?.id === p.id) || (subscription?.plan?.name === p.name);
            const rawPrice = billingCycle === 'yearly'
              ? (p.price_yearly ?? (p as any).price_annual ?? (p.price_monthly ? p.price_monthly * 10 : 0))
              : (p.price_monthly ?? 0);
            const price = Number(rawPrice) || 0;
            const cycleText = billingCycle === 'yearly' ? t.subscription.yearly : t.subscription.monthly;

            return (
              <View
                key={p.id}
                style={[
                  styles.planCard,
                  isCurrent && styles.planCardCurrent,
                  p.id === 'growth' && !isCurrent && styles.planCardHighlight,
                ]}
              >
                {p.id === 'growth' && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>{t.subscription.popular}</Text>
                  </View>
                )}

                <View style={styles.planTopRow}>
                  <View>
                    <Text style={styles.planName}>{p.name}</Text>
                    <Text style={styles.planCap}>
                      {p.max_students} {language === 'ta' ? 'மாணவர்கள் வரை' : 'students'} • {p.max_branches}{' '}
                      {language === 'ta' ? 'கிளை' : 'branch'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.planPrice}>₹{price.toLocaleString('en-IN')}</Text>
                    <Text style={styles.planCycle}>{cycleText}</Text>
                  </View>
                </View>

                {/* Features list */}
                <View style={styles.featureList}>
                  {(p.features || []).map((feat, idx) => (
                    <View key={idx} style={styles.featureRow}>
                      <CheckCircle2 size={14} color="#059669" style={{ marginTop: 2 }} />
                      <Text style={styles.featureText}>{feat}</Text>
                    </View>
                  ))}
                </View>

                {/* Action button */}
                <TouchableOpacity
                  style={[
                    styles.planActionBtn,
                    isCurrent ? styles.planActionBtnCurrent : styles.planActionBtnUpgrade,
                  ]}
                  onPress={() => (isCurrent ? onRefresh() : openUpgradeModal(p))}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.planActionBtnText,
                      isCurrent && { color: theme.colors.textSecondary },
                    ]}
                  >
                    {isCurrent
                      ? language === 'ta'
                        ? 'தற்போதைய திட்டம்'
                        : 'Current Plan'
                      : t.subscription.upgradePlan}
                  </Text>
                  {!isCurrent && <ChevronRight size={16} color="#FFFFFF" />}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 4. PAYMENT & SUPPORT INSTRUCTIONS                             */}
        {/* ───────────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t.subscription.paymentInstructions}</Text>
          <Text style={styles.supportDesc}>{t.subscription.paymentNote}</Text>

          <View style={styles.supportContactRow}>
            <View style={styles.contactItem}>
              <Phone size={18} color={theme.colors.primary} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.contactLabel}>{language === 'ta' ? 'தொலைபேசி ஆதரவு' : 'Phone Support'}</Text>
                <Text style={styles.contactVal}>{t.subscription.supportNumber}</Text>
              </View>
            </View>

            <View style={[styles.contactItem, { marginTop: 10 }]}>
              <Mail size={18} color={theme.colors.primary} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.contactLabel}>{language === 'ta' ? 'மின்னஞ்சல்' : 'Billing Email'}</Text>
                <Text style={styles.contactVal}>{t.subscription.supportEmail}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. UPGRADE / UPI PAYMENT MODAL                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedPlanForUpgrade?.name || t.subscription.upgradePlan}
                </Text>
                <Text style={styles.modalSubtitle}>{t.subscription.upiPayment}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPaymentModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Amount to pay */}
              <View style={styles.paymentSummaryBox}>
                <Text style={styles.payAmountLabel}>{language === 'ta' ? 'செலுத்த வேண்டிய தொகை' : 'Payable Amount'}</Text>
                <Text style={styles.payAmountValue}>
                  ₹
                  {Number(billingCycle === 'yearly'
                    ? (selectedPlanForUpgrade?.price_yearly ?? (selectedPlanForUpgrade as any)?.price_annual ?? 9990)
                    : (selectedPlanForUpgrade?.price_monthly ?? 999)
                  ).toLocaleString('en-IN')}{' '}
                  <Text style={{ fontSize: 13, fontWeight: '400', color: theme.colors.textSecondary }}>
                    ({billingCycle === 'yearly' ? 'Yearly Plan' : 'Monthly Plan'})
                  </Text>
                </Text>
              </View>

              {/* UPI ID Box */}
              <View style={styles.bankDetailCard}>
                <Text style={styles.bankDetailTitle}>UPI VPA / Google Pay / PhonePe</Text>
                <View style={styles.upiCopyRow}>
                  <Text style={styles.upiIdText}>billing@vagaisilambam</Text>
                  <TouchableOpacity
                    style={styles.upiCopyBtn}
                    onPress={() => {
                      Clipboard.setString('billing@vagaisilambam');
                      Alert.alert(t.common.success, 'UPI ID copied: billing@vagaisilambam');
                    }}
                  >
                    <Copy size={15} color={theme.colors.primary} />
                    <Text style={styles.upiCopyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Bank Transfer Details */}
              <View style={[styles.bankDetailCard, { marginTop: 12 }]}>
                <Text style={styles.bankDetailTitle}>NEFT / IMPS Bank Transfer</Text>
                <Text style={styles.bankTextLine}>
                  <Text style={styles.bankTextBold}>Account Name: </Text>Vagai Silambam Academy SaaS
                </Text>
                <Text style={styles.bankTextLine}>
                  <Text style={styles.bankTextBold}>Account No: </Text>50200084729103
                </Text>
                <Text style={styles.bankTextLine}>
                  <Text style={styles.bankTextBold}>IFSC Code: </Text>HDFC0001824
                </Text>
                <Text style={styles.bankTextLine}>
                  <Text style={styles.bankTextBold}>Bank & Branch: </Text>HDFC Bank, Chennai Main
                </Text>
              </View>

              <Text style={styles.paymentNotice}>
                {language === 'ta'
                  ? 'பரிவர்த்தனை முடிந்தவுடன், UTR எண் அல்லது ரசீதை billing@vagaisilambam.com க்கு பகிரவும்.'
                  : 'After completing payment, please share your UTR / transaction receipt with our billing team for instant activation.'}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalActionBtn}
              onPress={() => {
                setShowPaymentModal(false);
                Alert.alert(
                  t.common.success,
                  language === 'ta'
                    ? 'நன்றி! உங்கள் கட்டண குறிப்பு பதிவு செய்யப்பட்டது. நிர்வாகி சரிபார்த்ததும் கணக்கு புதுப்பிக்கப்படும்.'
                    : 'Thank you! Your upgrade request has been recorded. Once verified, your limits will be updated immediately.'
                );
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalActionBtnText}>
                {language === 'ta' ? 'கட்டணம் செலுத்திவிட்டேன்' : 'I Have Completed Payment'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  offlineBannerText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
    flex: 1,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A5B4FC',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  infoVal: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: 3,
  },
  licenseKeyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  licenseKeyLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  licenseKeyValue: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '700',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  copyBtn: {
    backgroundColor: '#FFFFFF',
    padding: 7,
    borderRadius: 8,
    marginLeft: 10,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  upgradeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.gold,
    paddingVertical: 12,
    borderRadius: 10,
    marginRight: 10,
  },
  upgradeBtnText: {
    color: '#1E1B4B',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  refreshIconBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 12,
    borderRadius: 10,
  },

  // General Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  limitAlertBoxDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  limitAlertTextDanger: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  limitAlertBoxWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  limitAlertTextWarning: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },

  // Quotas
  quotaItem: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quotaTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quotaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginLeft: 8,
  },
  quotaNumbers: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressNote: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 6,
  },

  // Plans Comparison
  plansHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  billingTab: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  billingTabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 1,
  },
  billingTabText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  billingTabTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  planCard: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  planCardCurrent: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F8FAFC',
  },
  planCardHighlight: {
    borderColor: theme.colors.gold,
    backgroundColor: '#FFFDF5',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 14,
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  popularBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E1B4B',
    textTransform: 'uppercase',
  },
  planTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  planName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  planCap: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  planCycle: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  featureList: {
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  featureText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 6,
    flex: 1,
  },
  planActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  planActionBtnUpgrade: {
    backgroundColor: theme.colors.primary,
  },
  planActionBtnCurrent: {
    backgroundColor: '#E2E8F0',
  },
  planActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 4,
  },

  // Support
  supportDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  supportContactRow: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  contactVal: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  paymentSummaryBox: {
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  payAmountLabel: {
    fontSize: 11,
    color: '#1E40AF',
    fontWeight: '600',
  },
  payAmountValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E3A8A',
    marginTop: 2,
  },
  bankDetailCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankDetailTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  upiCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  upiIdText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  upiCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  upiCopyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    marginLeft: 4,
  },
  bankTextLine: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  bankTextBold: {
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  paymentNotice: {
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 16,
    marginTop: 12,
  },
  modalActionBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
