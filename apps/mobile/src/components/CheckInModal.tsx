import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';
import { storefrontApi } from '../lib/api';

const { width } = Dimensions.get('window');

export const CheckInModal = () => {
  const { user, token, setUser, showCheckInModal, setShowCheckInModal } = useAuthStore();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const isAlreadyCheckedIn = user?.checkInHistory?.some((d: string) => d.split('T')[0] === today);

  useEffect(() => {
    if (isAlreadyCheckedIn) {
      setClaimed(true);
    } else {
      setClaimed(false);
    }
  }, [isAlreadyCheckedIn]);

  const closeModal = async () => {
    try {
      await AsyncStorage.setItem(`dismissedCheckIn_${today}`, 'true');
    } catch (e) {
      console.error(e);
    }
    setShowCheckInModal(false);
  };

  useEffect(() => {
    if (!token || !user) return;

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const lastCheckIn = user.lastCheckIn ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(user.lastCheckIn)) : '';

    const checkDismissed = async () => {
      try {
        const isDismissed = await AsyncStorage.getItem(`dismissedCheckIn_${today}`);
        if (lastCheckIn !== today && !isDismissed) {
          setShowCheckInModal(true);
        }
      } catch (e) {
        console.error(e);
      }
    };

    const timer = setTimeout(() => {
      void checkDismissed();
    }, 1500);

    return () => clearTimeout(timer);
  }, [token, user, setShowCheckInModal]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const response = await storefrontApi.dailyCheckIn();
      if (response.success) {
        setUser({
          ...user!,
          loyaltyPoints: response.data.loyaltyPoints,
          checkInHistory: response.data.checkInHistory,
          lastCheckIn: new Date().toISOString(),
        });
        setPointsEarned(response.data.pointsEarned || 1);
        setClaimed(true);
        setTimeout(() => {
          void closeModal();
        }, 2000);
      }
    } catch (error) {
      // Already checked in today (400) — just close the modal
      void closeModal();
    } finally {
      setClaiming(false);
    }
  };

  if (!showCheckInModal) return null;

  return (
    <Modal transparent visible={showCheckInModal} animationType="fade">
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={closeModal} />
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.coinContainer}>
              <Image source={require('../../assets/coin.png')} style={styles.coin} />
            </View>
            <Text style={styles.title}>Daily Rewards</Text>
            <Text style={styles.subtitle}>Collect points every day!</Text>
          </View>
 
          <View style={styles.content}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Your Streak</Text>
              <MaterialCommunityIcons name="star-circle" size={24} color="#F59E0B" />
            </View>
 
            <View style={styles.streakContainer}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                const now = new Date();
                const dayOfWeek = (now.getDay() + 6) % 7;
                const isToday = i === dayOfWeek;
                
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - dayOfWeek);
                const dayDate = new Date(startOfWeek);
                dayDate.setDate(startOfWeek.getDate() + i);
                const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(dayDate);
                
                const isChecked = (user?.checkInHistory || []).some((d: string) => d.split('T')[0] === dateStr);
 
                return (
                  <View key={i} style={[
                    styles.dayCircle, 
                    isToday && styles.todayCircle,
                    isChecked && styles.checkedCircle
                  ]}>
                    {isChecked ? (
                      <Feather name="check" size={14} color="#10B981" />
                    ) : (
                      <Text style={[styles.dayText, isToday && styles.todayText]}>{day}</Text>
                    )}
                  </View>
                );
              })}
            </View>
 
            {!token ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ textAlign: 'center', color: '#64748B', fontSize: 13, marginBottom: 20, fontWeight: '600' }}>
                  Please log in to your account to claim daily reward points and track your progress!
                </Text>
                <Pressable 
                  onPress={() => {
                    void closeModal();
                    router.push('/(auth)/login');
                  }} 
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>LOGIN TO CLAIM</Text>
                </Pressable>
              </View>
            ) : !claimed ? (
              <Pressable 
                onPress={handleClaim} 
                disabled={claiming}
                style={({ pressed }) => [
                  styles.button, 
                  claiming && styles.buttonDisabled,
                  pressed && styles.buttonPressed
                ]}
              >
                <Text style={styles.buttonText}>{claiming ? 'CLAIMING...' : 'CLAIM DAILY REWARD'}</Text>
              </Pressable>
            ) : (
              <View style={styles.claimedWrapper}>
                <View style={styles.claimedContainer}>
                  <Feather name="check-circle" size={24} color="#10B981" />
                  <Text style={styles.claimedText}>
                    {pointsEarned ? `CLAIMED ${pointsEarned} POINTS SUCCESSFULLY!` : 'ALREADY CLAIMED TODAY!'}
                  </Text>
                </View>
                <Pressable 
                  onPress={closeModal} 
                  style={({ pressed }) => [
                    styles.closeButtonOutline,
                    pressed && styles.buttonPressed
                  ]}
                >
                  <Text style={styles.closeButtonOutlineText}>CLOSE</Text>
                </Pressable>
              </View>
            )}
          </View>
 
          <Pressable onPress={closeModal} style={styles.closeButton} className="active:scale-90">
            <Feather name="x" size={20} color="#94A3B8" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 32, 24, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 32,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  header: {
    height: 160,
    backgroundColor: '#1B4332',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinContainer: {
    width: 64,
    height: 64,
    backgroundColor: 'white',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  coin: {
    width: 40,
    height: 40,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  content: {
    padding: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#082018',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  streakContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dayCircle: {
    width: (width - 120) / 7,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayCircle: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  checkedCircle: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  dayText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
  },
  todayText: {
    color: '#059669',
  },
  button: {
    backgroundColor: '#082018',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 } as any],
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  claimedContainer: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  claimedText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  claimedWrapper: {
    gap: 8,
  },
  closeButtonOutline: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonOutlineText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
