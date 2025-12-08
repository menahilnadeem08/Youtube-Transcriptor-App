import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '../config/api';

const { width } = Dimensions.get('window');

export default function PricingScreen() {
  const navigation = useNavigation();
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch(`${API_URL}/plans`);
      if (response.ok) {
        const data = await response.json();
        const plansArray = data.plans || [];
        setPlans(plansArray);
        
        const freePlan = plansArray.find(p => p.price === 0);
        if (freePlan) {
          setSelectedPlan(freePlan.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
      setPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  };

  const handlePlanSelect = async (planId, plan) => {
    setSelectedPlan(planId);
    
    if (plan.price > 0) {
      setProcessingPayment(planId);
      try {
        const response = await fetch(`${API_URL}/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            targetLanguage: 'Spanish',
            planId: planId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create payment session');
        }

        const data = await response.json();
        
        if (data.url) {
          const canOpen = await Linking.canOpenURL(data.url);
          if (canOpen) {
            await Linking.openURL(data.url);
          } else {
            Alert.alert('Error', 'Cannot open payment URL');
          }
        }
      } catch (error) {
        console.error('Payment initiation failed:', error);
        Alert.alert('Error', 'Failed to initiate payment. Please try again.');
      } finally {
        setProcessingPayment(null);
      }
    } else {
      navigation.navigate('Generate');
    }
  };

  const planFeatures = {
    free: [
      'Basic transcript extraction',
      'Translation to 50+ languages',
      'TXT export format',
      'Standard processing speed',
    ],
    basic: [
      'Everything in Free',
      'PDF & DOCX export',
      'Faster processing',
      'Priority support',
      'No ads',
    ],
    premium: [
      'Everything in Basic',
      'Priority processing queue',
      'Enhanced accuracy',
      'Bulk processing',
      'API access (coming soon)',
      '24/7 priority support',
    ],
  };

  if (loadingPlans) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.loadingText}>Loading plans...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Choose Your Plan</Text>
          <Text style={styles.headerSubtitle}>
            Select the perfect plan for your needs
          </Text>
        </View>

        <View style={styles.plansContainer}>
          {plans.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No plans available at the moment.
              </Text>
              <Text style={styles.emptySubtext}>
                Please check back later or contact support.
              </Text>
            </View>
          ) : (
            plans.map((plan) => {
              const isFree = plan.price === 0;
              const isSelected = selectedPlan === plan.id;
              const features = planFeatures[plan.id] || [];

              return (
                <TouchableOpacity
                  key={plan.id}
                  onPress={() => handlePlanSelect(plan.id, plan)}
                  style={[
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                  ]}
                >
                  {plan.id === 'premium' && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Most Popular</Text>
                    </View>
                  )}

                  {isFree && (
                    <View style={[styles.badge, styles.freeBadge]}>
                      <Text style={styles.badgeText}>Free Forever</Text>
                    </View>
                  )}

                  <View style={styles.planIcon}>
                    <Ionicons
                      name={
                        isFree
                          ? 'sparkles'
                          : plan.id === 'premium'
                          ? 'flash'
                          : 'checkmark-circle'
                      }
                      size={40}
                      color={isFree ? '#10b981' : plan.id === 'premium' ? '#f59e0b' : '#667eea'}
                    />
                  </View>

                  <Text style={styles.planName}>{plan.name}</Text>

                  <View style={styles.priceContainer}>
                    <Text style={styles.price}>{plan.priceFormatted}</Text>
                    {!isFree && (
                      <Text style={styles.priceUnit}>/transcript</Text>
                    )}
                  </View>

                  <Text style={styles.planDescription}>{plan.description}</Text>

                  <View style={styles.featuresList}>
                    {features.map((feature, index) => (
                      <View key={index} style={styles.featureItem}>
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color="#10b981"
                        />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.selectButton,
                      isSelected && styles.selectButtonSelected,
                      processingPayment === plan.id && styles.selectButtonDisabled,
                    ]}
                    onPress={() => handlePlanSelect(plan.id, plan)}
                    disabled={processingPayment === plan.id}
                  >
                    {processingPayment === plan.id ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text
                        style={[
                          styles.selectButtonText,
                          isSelected && styles.selectButtonTextSelected,
                        ]}
                      >
                        {isFree
                          ? 'Select Free Plan →'
                          : isSelected
                          ? 'Continue to Payment →'
                          : `Select ${plan.name} →`}
                      </Text>
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            💡 All plans include the same core features. Premium plans offer faster processing and additional export formats.
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
    fontSize: 16,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  plansContainer: {
    gap: 24,
  },
  emptyContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  planCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 32,
    borderWidth: 3,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  planCardSelected: {
    borderColor: '#667eea',
    shadowColor: '#667eea',
    shadowOpacity: 0.4,
  },
  badge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  freeBadge: {
    backgroundColor: '#10b981',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  planIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 16,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#667eea',
  },
  priceUnit: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  planDescription: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
    fontSize: 14,
    minHeight: 40,
  },
  featuresList: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  selectButton: {
    width: '100%',
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#667eea',
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  selectButtonSelected: {
    backgroundColor: '#667eea',
  },
  selectButtonDisabled: {
    backgroundColor: '#9ca3af',
    borderColor: '#9ca3af',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  selectButtonTextSelected: {
    color: 'white',
  },
  noteContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  noteText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.9,
  },
});

