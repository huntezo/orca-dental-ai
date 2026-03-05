"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Upload, 
  FileImage, 
  Sparkles, 
  FileText, 
  CheckCircle,
  ChevronRight,
  ChevronLeft
} from "lucide-react";

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

export default function OnboardingPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: locale === "ar" ? "مرحباً بك في Orca Dental AI" : "Welcome to Orca Dental AI",
      description: locale === "ar" 
        ? "دعنا نرشدك خلال خطوات تحليل صور الأسنان باستخدام الذكاء الاصطناعي"
        : "Let us guide you through analyzing dental images with AI",
      icon: Sparkles,
    },
    {
      id: 2,
      title: locale === "ar" ? "إنشاء حالة جديدة" : "Create a New Case",
      description: locale === "ar"
        ? "ابدأ بإنشاء حالة جديدة وإدخال رمز المريض. يمكنك إضافة ملاحظات اختيارية."
        : "Start by creating a new case and entering a patient code. You can add optional notes.",
      icon: FileText,
    },
    {
      id: 3,
      title: locale === "ar" ? "رفع الصور" : "Upload Images",
      description: locale === "ar"
        ? "ارفع صور الأشعة السينية أو الصور الفموية. نحن ندعم JPEG و PNG."
        : "Upload your X-ray or intraoral images. We support JPEG and PNG formats.",
      icon: Upload,
    },
    {
      id: 4,
      title: locale === "ar" ? "الحصول على التحليل" : "Get AI Analysis",
      description: locale === "ar"
        ? "اضغط على 'بدء التحليل' وانتظر بضع ثوانٍ. ستحصل على قياسات تلقائية وتقرير PDF."
        : "Click 'Start Analysis' and wait a few seconds. You'll get automatic measurements and a PDF report.",
      icon: FileImage,
    },
  ];

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  async function checkOnboardingStatus() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push(`/${locale}/auth/login`);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, onboarding_step")
        .eq("id", user.id)
        .single();

      if (profile?.onboarding_completed) {
        router.push(`/${locale}/app`);
        return;
      }

      setCurrentStep(profile?.onboarding_step || 0);
    } catch (error) {
      console.error("Error checking onboarding status:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateOnboardingStep(step: number) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      await supabase
        .from("profiles")
        .update({ onboarding_step: step })
        .eq("id", user.id);
    } catch (error) {
      console.error("Error updating onboarding step:", error);
    }
  }

  async function completeOnboarding() {
    try {
      setCompleting(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      await supabase.rpc("complete_onboarding", {
        p_user_id: user.id,
      });

      router.push(`/${locale}/app`);
    } catch (error) {
      console.error("Error completing onboarding:", error);
    } finally {
      setCompleting(false);
    }
  }

  function handleNext() {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      updateOnboardingStep(nextStep);
    } else {
      completeOnboarding();
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      updateOnboardingStep(prevStep);
    }
  }

  function handleSkip() {
    completeOnboarding();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-blue"></div>
      </div>
    );
  }

  const StepIcon = steps[currentStep].icon;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-8">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    index <= currentStep
                      ? "bg-medical-blue text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {index < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    step.id
                  )}
                </div>
              ))}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-medical-blue h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Step Content */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <StepIcon className="w-10 h-10 text-medical-blue" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {steps[currentStep].title}
            </h1>
            <p className="text-gray-600 text-lg max-w-md mx-auto">
              {steps[currentStep].description}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              {locale === "ar" ? "السابق" : "Back"}
            </Button>

            <div className="flex items-center gap-3">
              {!isLastStep && (
                <Button variant="ghost" onClick={handleSkip}>
                  {locale === "ar" ? "تخطي" : "Skip"}
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={completing}
                className="gap-2"
              >
                {completing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {locale === "ar" ? "جاري..." : "Loading..."}
                  </>
                ) : isLastStep ? (
                  <>
                    {locale === "ar" ? "ابدأ" : "Get Started"}
                    <CheckCircle className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    {locale === "ar" ? "التالي" : "Next"}
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
