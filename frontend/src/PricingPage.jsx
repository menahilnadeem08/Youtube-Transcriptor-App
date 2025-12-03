import React, { useState, useEffect } from 'react';
import { CheckCircle, Sparkles, Zap } from 'lucide-react';

export default function PricingPage({ onPlanSelect, selectedPlan: externalSelectedPlan }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(externalSelectedPlan || null);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_URL}/plans`);
        if (response.ok) {
          const data = await response.json();
          setPlans(data.plans || []);
          // Set default to free plan if available
          const freePlan = data.plans?.find(p => p.price === 0);
          if (freePlan && !selectedPlan) {
            setSelectedPlan(freePlan.id);
            if (onPlanSelect) onPlanSelect(freePlan.id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch plans:', err);
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

  const handlePlanSelect = (planId) => {
    setSelectedPlan(planId);
    if (onPlanSelect) {
      onPlanSelect(planId);
    }
  };

  const planFeatures = {
    free: [
      'Basic transcript extraction',
      'Translation to 8 languages',
      'TXT export format',
      'Standard processing speed'
    ],
    basic: [
      'Everything in Free',
      'PDF & DOCX export',
      'Faster processing',
      'Priority support',
      'No ads'
    ],
    premium: [
      'Everything in Basic',
      'Priority processing queue',
      'Enhanced accuracy',
      'Bulk processing',
      'API access (coming soon)',
      '24/7 priority support'
    ]
  };

  if (loadingPlans) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'white' }}>
        <div style={{ fontSize: '1.2rem' }}>Loading plans...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        color: 'white',
        marginBottom: '50px'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          marginBottom: '16px'
        }}>
          Choose Your Plan
        </h1>
        <p style={{
          fontSize: '1.2rem',
          opacity: 0.9
        }}>
          Select the perfect plan for your needs
        </p>
      </div>

      {/* Plans Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {plans.map((plan) => {
          const isFree = plan.price === 0;
          const isSelected = selectedPlan === plan.id;
          const features = planFeatures[plan.id] || [];

          return (
            <div
              key={plan.id}
              onClick={() => handlePlanSelect(plan.id)}
              style={{
                backgroundColor: 'white',
                borderRadius: '20px',
                padding: '32px',
                boxShadow: isSelected
                  ? '0 20px 60px rgba(102, 126, 234, 0.4)'
                  : '0 10px 30px rgba(0,0,0,0.2)',
                border: `3px solid ${isSelected ? '#667eea' : '#e5e7eb'}`,
                cursor: 'pointer',
                transition: 'all 0.3s',
                position: 'relative',
                transform: isSelected ? 'scale(1.05)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              {/* Popular Badge */}
              {plan.id === 'premium' && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  right: '20px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  Most Popular
                </div>
              )}

              {/* Free Badge */}
              {isFree && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  right: '20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  Free Forever
                </div>
              )}

              {/* Plan Icon */}
              <div style={{
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'center'
              }}>
                {isFree ? (
                  <Sparkles size={40} style={{ color: '#10b981' }} />
                ) : plan.id === 'premium' ? (
                  <Zap size={40} style={{ color: '#f59e0b' }} />
                ) : (
                  <CheckCircle size={40} style={{ color: '#667eea' }} />
                )}
              </div>

              {/* Plan Name */}
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '8px',
                color: '#333',
                textAlign: 'center'
              }}>
                {plan.name}
              </h3>

              {/* Price */}
              <div style={{
                textAlign: 'center',
                marginBottom: '24px'
              }}>
                <span style={{
                  fontSize: '3rem',
                  fontWeight: 'bold',
                  color: '#667eea'
                }}>
                  {plan.priceFormatted}
                </span>
                {!isFree && (
                  <span style={{
                    fontSize: '1rem',
                    color: '#666',
                    marginLeft: '4px'
                  }}>
                    /transcript
                  </span>
                )}
              </div>

              {/* Description */}
              <p style={{
                textAlign: 'center',
                color: '#666',
                marginBottom: '24px',
                fontSize: '0.9rem',
                minHeight: '40px'
              }}>
                {plan.description}
              </p>

              {/* Features List */}
              <ul style={{
                listStyle: 'none',
                padding: 0,
                marginBottom: '24px'
              }}>
                {features.map((feature, index) => (
                  <li
                    key={index}
                    style={{
                      padding: '8px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#333',
                      fontSize: '0.9rem'
                    }}
                  >
                    <CheckCircle
                      size={18}
                      style={{
                        color: '#10b981',
                        flexShrink: 0
                      }}
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Select Button */}
              <button
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: isSelected ? 'white' : '#667eea',
                  backgroundColor: isSelected ? '#667eea' : 'transparent',
                  border: `2px solid #667eea`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.target.style.backgroundColor = '#f0f4ff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.target.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {isSelected ? '✓ Selected' : isFree ? 'Select Free Plan' : 'Select Plan'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Note */}
      <div style={{
        textAlign: 'center',
        marginTop: '40px',
        color: 'white',
        opacity: 0.8,
        fontSize: '0.9rem'
      }}>
        💡 All plans include the same core features. Premium plans offer faster processing and additional export formats.
      </div>
    </div>
  );
}

