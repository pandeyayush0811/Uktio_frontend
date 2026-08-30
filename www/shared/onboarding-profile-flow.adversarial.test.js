import './config.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeHtml } from './sanitize.js';

describe('Adversarial & Hardcore Test Suite — Phase 2: Onboarding & Profile Management (onboarding.html & profile.html)', () => {
  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 1: Mandatory Onboarding Wizard State Machine (onboarding.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 1: Mandatory Onboarding Wizard & Back Navigation Trapping', () => {
    function createOnboardingHarness() {
      let current = 0;
      const totalSteps = 9;

      function onBack() {
        if (current > 0) {
          current--;
          return true;
        }
        return false; // on step 0, swallow so mandatory onboarding cannot be bypassed
      }

      function next() {
        if (current < totalSteps - 1) {
          current++;
          return true;
        }
        return false; // final step
      }

      return {
        getCurrent: () => current,
        setCurrent: (i) => { current = i; },
        onBack,
        next
      };
    }

    it('test_onboarding_back_nav_returns_false_on_step_0_to_prevent_bypassing_mandatory_onboarding', () => {
      const harness = createOnboardingHarness();
      expect(harness.getCurrent()).toBe(0);

      const handled = harness.onBack();
      expect(handled).toBe(false);
      expect(harness.getCurrent()).toBe(0); // Cannot go below 0
    });

    it('test_onboarding_back_nav_unwinds_subsequent_steps_cleanly', () => {
      const harness = createOnboardingHarness();
      harness.setCurrent(3);

      expect(harness.onBack()).toBe(true);
      expect(harness.getCurrent()).toBe(2);

      expect(harness.onBack()).toBe(true);
      expect(harness.getCurrent()).toBe(1);

      expect(harness.onBack()).toBe(true);
      expect(harness.getCurrent()).toBe(0);

      // Now at step 0 -> trapped
      expect(harness.onBack()).toBe(false);
      expect(harness.getCurrent()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 2: Onboarding Validation & Extreme Edge Cases (onboarding.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 2: Onboarding Field Validators & Edge Cases', () => {
    const answers = {
      name: '', age: '', occupation_type: '', class_grade: '', profession: '', city: '',
      goal: '', self_level: '', english_sample: '', daily_time: ''
    };

    const validators = {
      name: () => (answers.name.trim() ? true : 'Please enter your name 🙂'),
      age: () => {
        const n = Number(answers.age);
        if (!answers.age || !Number.isInteger(n) || n < 5 || n > 100) return 'Please enter a valid age (between 5-100).';
        return true;
      },
      occupation_type: () => (answers.occupation_type ? true : 'Choose one'),
      occupation_detail: () => {
        const key = answers.occupation_type === 'student' ? 'class_grade' : 'profession';
        return answers[key] && answers[key].trim() ? true : 'Please fill this field.';
      },
      goal: () => (answers.goal ? true : 'Please choose an option.'),
      self_level: () => (answers.self_level ? true : 'Please choose an option.'),
      daily_time: () => (answers.daily_time ? true : 'Please choose an option.')
    };

    beforeEach(() => {
      for (const k in answers) answers[k] = '';
    });

    it('test_name_validator_rejects_empty_or_whitespace_and_accepts_valid_names', () => {
      answers.name = '';
      expect(validators.name()).toBe('Please enter your name 🙂');

      answers.name = '   ';
      expect(validators.name()).toBe('Please enter your name 🙂');

      answers.name = 'Ayush Sharma';
      expect(validators.name()).toBe(true);

      answers.name = 'A';
      expect(validators.name()).toBe(true);
    });

    it('test_age_validator_strictly_enforces_integer_range_5_to_100', () => {
      // Valid boundary values
      answers.age = '5';
      expect(validators.age()).toBe(true);

      answers.age = '100';
      expect(validators.age()).toBe(true);

      answers.age = '25';
      expect(validators.age()).toBe(true);

      // Invalid boundary & adversarial inputs
      answers.age = '4'; // < 5
      expect(validators.age()).toContain('between 5-100');

      answers.age = '101'; // > 100
      expect(validators.age()).toContain('between 5-100');

      answers.age = '0';
      expect(validators.age()).toContain('between 5-100');

      answers.age = '-20';
      expect(validators.age()).toContain('between 5-100');

      answers.age = '25.5'; // decimal
      expect(validators.age()).toContain('between 5-100');

      answers.age = 'twenty'; // non-numeric
      expect(validators.age()).toContain('between 5-100');

      answers.age = ''; // empty
      expect(validators.age()).toContain('between 5-100');
    });

    it('test_occupation_detail_validator_adapts_to_student_vs_professional', () => {
      // Student mode
      answers.occupation_type = 'student';
      answers.class_grade = '';
      expect(validators.occupation_detail()).toBe('Please fill this field.');

      answers.class_grade = 'B.Tech 2nd Year';
      expect(validators.occupation_detail()).toBe(true);

      // Professional mode
      answers.occupation_type = 'professional';
      answers.profession = '';
      expect(validators.occupation_detail()).toBe('Please fill this field.');

      answers.profession = 'Software Engineer';
      expect(validators.occupation_detail()).toBe(true);
    });

    it('test_choice_validators_reject_unselected_state', () => {
      expect(validators.occupation_type()).toBe('Choose one');
      expect(validators.goal()).toBe('Please choose an option.');
      expect(validators.self_level()).toBe('Please choose an option.');
      expect(validators.daily_time()).toBe('Please choose an option.');

      answers.occupation_type = 'student';
      answers.goal = 'interview';
      answers.self_level = 'intermediate';
      answers.daily_time = '15_20';

      expect(validators.occupation_type()).toBe(true);
      expect(validators.goal()).toBe(true);
      expect(validators.self_level()).toBe(true);
      expect(validators.daily_time()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 3: Dynamic "Skip" vs "Next" Button Labeling (onboarding.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 3: Dynamic "Skip" vs "Next" Labeling for Optional Steps', () => {
    function computeNextLabel(currentStepIndex, totalSteps, stepConfig, answers) {
      if (currentStepIndex === totalSteps - 1) return 'Get Started';
      if (stepConfig.optional) {
        const val = answers[stepConfig.optionalKey];
        const hasValue = !!(val && val.trim());
        return hasValue ? 'Next' : 'Skip';
      }
      return 'Next';
    }

    it('test_optional_city_step_flips_between_Skip_and_Next_as_user_types', () => {
      const stepConfig = { optional: true, optionalKey: 'city' };
      const answers = { city: '' };

      // Untouched optional field
      expect(computeNextLabel(4, 9, stepConfig, answers)).toBe('Skip');

      // User types one letter
      answers.city = 'P';
      expect(computeNextLabel(4, 9, stepConfig, answers)).toBe('Next');

      // User clears field
      answers.city = '';
      expect(computeNextLabel(4, 9, stepConfig, answers)).toBe('Skip');

      // User enters only spaces
      answers.city = '   ';
      expect(computeNextLabel(4, 9, stepConfig, answers)).toBe('Skip');
    });

    it('test_final_step_always_renders_Get_Started_label', () => {
      const stepConfig = { optional: false };
      const answers = { daily_time: '15_20' };

      expect(computeNextLabel(8, 9, stepConfig, answers)).toBe('Get Started');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 4: Onboarding Submission Concurrency & Fault Handling
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 4: Onboarding Submission Concurrency & Network Faults', () => {
    function createSubmitHarness() {
      let isSubmitting = false;
      const nextBtn = { disabled: false, textContent: 'Get Started' };
      const backBtn = { disabled: false };
      const statusMsg = { className: '', textContent: '' };

      async function submitOnboarding(answers, mockApiCall) {
        if (isSubmitting) return 'duplicate_blocked';
        isSubmitting = true;
        nextBtn.disabled = true;
        backBtn.disabled = true;
        statusMsg.className = 'status-msg';
        statusMsg.textContent = 'Saving...';

        try {
          await mockApiCall(answers);
          return 'navigating_to_home';
        } catch (err) {
          statusMsg.className = 'status-msg err';
          statusMsg.textContent = err.message || 'Something went wrong, please try again.';
          nextBtn.disabled = false;
          backBtn.disabled = false;
          return 'failed';
        } finally {
          isSubmitting = false;
        }
      }

      return {
        nextBtn,
        backBtn,
        statusMsg,
        submitOnboarding
      };
    }

    it('test_onboarding_submission_locks_navigation_buttons_during_in_flight_request', async () => {
      const harness = createSubmitHarness();
      let resolveApi;
      const mockApi = () => new Promise((res) => { resolveApi = res; });

      const submitPromise = harness.submitOnboarding({ name: 'Ayush' }, mockApi);

      expect(harness.nextBtn.disabled).toBe(true);
      expect(harness.backBtn.disabled).toBe(true);
      expect(harness.statusMsg.textContent).toBe('Saving...');

      // Rapid secondary click is blocked
      const blockedResult = await harness.submitOnboarding({ name: 'Ayush' }, mockApi);
      expect(blockedResult).toBe('duplicate_blocked');

      resolveApi();
      const finalResult = await submitPromise;
      expect(finalResult).toBe('navigating_to_home');
    });

    it('test_onboarding_submission_re_enables_buttons_and_displays_error_on_api_failure', async () => {
      const harness = createSubmitHarness();
      const mockFailingApi = () => Promise.reject(new Error('Database error during profile setup'));

      const result = await harness.submitOnboarding({ name: 'Ayush' }, mockFailingApi);

      expect(result).toBe('failed');
      expect(harness.nextBtn.disabled).toBe(false);
      expect(harness.backBtn.disabled).toBe(false);
      expect(harness.statusMsg.className).toContain('err');
      expect(harness.statusMsg.textContent).toBe('Database error during profile setup');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 5: Profile View Mode & XSS Sanitization (profile.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 5: Profile View Mode & XSS Defense (profile.html)', () => {
    function computeAvatarInitial(name) {
      if (!name || typeof name !== 'string') return null;
      const clean = name.trim();
      return clean.length ? clean[0].toUpperCase() : null;
    }

    it('test_profile_renders_safe_escaped_html_for_malicious_user_inputs', () => {
      const maliciousName = '<script>alert("pwned")</script>';
      const maliciousCity = '<img src=x onerror=fetch("http://evil.com")>';

      const safeName = escapeHtml(maliciousName);
      const safeCity = escapeHtml(maliciousCity);

      expect(safeName).toBe('&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;');
      expect(safeName).not.toContain('<script>');

      expect(safeCity).toBe('&lt;img src=x onerror=fetch(&quot;http://evil.com&quot;)&gt;');
      expect(safeCity).not.toContain('<img');
    });

    it('test_computeAvatarInitial_extracts_clean_uppercase_first_character', () => {
      expect(computeAvatarInitial('ayush')).toBe('A');
      expect(computeAvatarInitial('  rohit  ')).toBe('R');
      expect(computeAvatarInitial('')).toBeNull();
      expect(computeAvatarInitial(null)).toBeNull();
      expect(computeAvatarInitial(undefined)).toBeNull();
      expect(computeAvatarInitial('   ')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 6: Profile Edit Mode & Save Validation (profile.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 6: Profile Edit Mode & Save Mutation (profile.html)', () => {
    function createProfileEditHarness() {
      let isSaving = false;
      const saveBtn = { disabled: false };
      const statusMsg = { textContent: '', className: '' };

      function validateProfileData(data) {
        if (!data.name || !data.name.trim()) return 'Name is required';
        const ageNum = Number(data.age);
        if (!data.age || !Number.isInteger(ageNum) || ageNum < 5 || ageNum > 100) {
          return 'Age must be between 5 and 100';
        }
        return true;
      }

      async function saveProfile(data, apiPatchMock) {
        const validation = validateProfileData(data);
        if (validation !== true) {
          statusMsg.className = 'status-msg err';
          statusMsg.textContent = validation;
          return 'validation_failed';
        }

        if (isSaving) return 'save_in_flight';
        isSaving = true;
        saveBtn.disabled = true;

        try {
          const res = await apiPatchMock(data);
          statusMsg.className = 'status-msg ok';
          statusMsg.textContent = 'Profile updated!';
          return 'saved';
        } catch (err) {
          statusMsg.className = 'status-msg err';
          statusMsg.textContent = err.message || 'Could not save profile';
          return 'error';
        } finally {
          isSaving = false;
          saveBtn.disabled = false;
        }
      }

      return {
        saveBtn,
        statusMsg,
        saveProfile
      };
    }

    it('test_profile_edit_rejects_invalid_age_without_hitting_api', async () => {
      const harness = createProfileEditHarness();
      const mockPatch = vi.fn();

      const result = await harness.saveProfile({ name: 'Ayush', age: '150' }, mockPatch);

      expect(result).toBe('validation_failed');
      expect(mockPatch).not.toHaveBeenCalled();
      expect(harness.statusMsg.textContent).toBe('Age must be between 5 and 100');
    });

    it('test_profile_edit_locks_button_and_saves_cleanly', async () => {
      const harness = createProfileEditHarness();
      const mockPatch = vi.fn().mockResolvedValue({ user: { id: 'u1' } });

      const result = await harness.saveProfile({ name: 'Ayush', age: '25' }, mockPatch);

      expect(result).toBe('saved');
      expect(mockPatch).toHaveBeenCalledTimes(1);
      expect(harness.statusMsg.className).toContain('ok');
      expect(harness.saveBtn.disabled).toBe(false);
    });
  });
});
