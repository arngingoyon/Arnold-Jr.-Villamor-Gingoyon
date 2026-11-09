/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import {
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  FileSpreadsheet,
  UserCheck,
  Menu,
  X
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType
} from './firebase';
import {
  CompanyDocCategory,
  InteractionCategory,
  isSuperAdminUser,
  stripUndefined,
  SUPER_ADMIN_EMAIL,
  validateAuditInteractionPayload
} from './utils/auditValidation';
import {
  INITIAL_COMPANY_AUDIT_DOCS,
  INITIAL_DEMO_INTERACTIONS,
  INITIAL_DEMO_PROFILE,
  StoredAuditInteraction,
  StoredCompanyDoc,
  StoredUserProfile
} from './utils/seedData';
import { LandingView } from './components/LandingView';
import { UserDashboardView } from './components/UserDashboardView';
import { SuperAdminView } from './components/SuperAdminView';
import { SecurityWalkthroughModal } from './components/SecurityWalkthroughModal';

function formatTimestamp(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    return new Date((val as { seconds: number }).seconds * 1000).toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export default function App() {
  // Firebase Auth State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Interactive Sandbox / Autostart State for Headless Verification & Demo Exploration
  const [demoRole, setDemoRole] = useState<'none' | 'employee' | 'admin'>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'admin') return 'admin';
    if (params.get('autostart') === '1' || params.get('role') === 'employee') {
      return 'employee';
    }
    return 'none';
  });

  // Active Console Mode ('employee_dashboard' | 'super_admin')
  const [activeWorkspace, setActiveWorkspace] = useState<
    'employee_dashboard' | 'super_admin'
  >(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('role') === 'admin' ? 'super_admin' : 'employee_dashboard';
  });

  // Mobile Sidebar State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Security & Walkthrough Reference Modal
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  // Application Data State
  const [userProfile, setUserProfile] = useState<StoredUserProfile | null>(
    INITIAL_DEMO_PROFILE
  );
  const [userInteractions, setUserInteractions] = useState<StoredAuditInteraction[]>(
    INITIAL_DEMO_INTERACTIONS.filter((i) => i.userId === INITIAL_DEMO_PROFILE.uid)
  );
  const [allAdminInteractions, setAllAdminInteractions] = useState<
    StoredAuditInteraction[]
  >(INITIAL_DEMO_INTERACTIONS);
  const [allAdminProfiles, setAllAdminProfiles] = useState<StoredUserProfile[]>([
    INITIAL_DEMO_PROFILE
  ]);
  const [companyDocs, setCompanyDocs] = useState<StoredCompanyDoc[]>(
    INITIAL_COMPANY_AUDIT_DOCS
  );

  // Guaranteed Transaction Verification Retry State
  const [pendingRetryAction, setPendingRetryAction] = useState<{
    message: string;
    onRetry: () => Promise<void>;
  } | null>(null);

  // Determine effective identity
  const isLiveAuthenticated = Boolean(firebaseUser);
  const isEffectiveSuperAdmin = isLiveAuthenticated
    ? isSuperAdminUser(firebaseUser?.email, firebaseUser?.emailVerified)
    : demoRole === 'admin';

  const currentUid = isLiveAuthenticated
    ? firebaseUser!.uid
    : demoRole === 'admin'
      ? 'super_admin_arn'
      : INITIAL_DEMO_PROFILE.uid;

  const currentEmail = isLiveAuthenticated
    ? firebaseUser!.email || ''
    : demoRole === 'admin'
      ? SUPER_ADMIN_EMAIL
      : 'elena.vance@enterprise-ops.io';

  const currentDisplayName = isLiveAuthenticated
    ? firebaseUser!.displayName || firebaseUser!.email?.split('@')[0] || 'Employee'
    : demoRole === 'admin'
      ? 'Arn Gingoyon (Super Admin)'
      : INITIAL_DEMO_PROFILE.displayName;

  // Listen to Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);
      if (user) {
        setDemoRole('none');
        if (isSuperAdminUser(user.email, user.emailVerified)) {
          setActiveWorkspace('super_admin');
        } else {
          setActiveWorkspace('employee_dashboard');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Attach Firestore Listeners ONLY when Auth is Ready and Live User is Authenticated
  useEffect(() => {
    if (!isAuthReady || !firebaseUser) return;

    const uid = firebaseUser.uid;
    const isAdmin = isSuperAdminUser(firebaseUser.email, firebaseUser.emailVerified);

    // 1. User Profile Listener (/users/{uid})
    const profileRef = doc(db, 'users', uid);
    const unsubProfile = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUserProfile({
            uid: String(data.uid || uid),
            displayName: String(data.displayName || ''),
            jobRole: String(data.jobRole || ''),
            department: String(data.department || ''),
            jobDescription: String(data.jobDescription || ''),
            createdAt: formatTimestamp(data.createdAt),
            updatedAt: formatTimestamp(data.updatedAt)
          });
        } else {
          setUserProfile(null);
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, `users/${uid}`);
        } catch (reportedErr) {
          console.warn(reportedErr);
        }
      }
    );

    // 2. User Isolated Interactions Listener (/users/{uid}/interactions)
    const interactionsQuery = isAdmin
      ? collection(db, 'users', uid, 'interactions')
      : query(
          collection(db, 'users', uid, 'interactions'),
          where('userId', '==', uid)
        );

    const unsubInteractions = onSnapshot(
      interactionsQuery,
      (snap) => {
        const items: StoredAuditInteraction[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || uid),
            sessionId: String(data.sessionId || 'sess_default'),
            category: (data.category as InteractionCategory) || 'general_reflection',
            userPrompt: String(data.userPrompt || ''),
            aiResponse: String(data.aiResponse || ''),
            executiveSummary: String(data.executiveSummary || ''),
            brainstormingIdeas: String(data.brainstormingIdeas || ''),
            auditAlignment: String(data.auditAlignment || ''),
            severityLevel: data.severityLevel || 'medium',
            userRoleSnapshot: String(data.userRoleSnapshot || ''),
            userNameSnapshot: String(data.userNameSnapshot || ''),
            createdAt: formatTimestamp(data.createdAt)
          };
        });
        items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setUserInteractions(items);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, `users/${uid}/interactions`);
        } catch (reportedErr) {
          console.warn(reportedErr);
        }
      }
    );

    // 3. Published Company Docs Listener (/company_docs)
    const companyDocsQuery = isAdmin
      ? collection(db, 'company_docs')
      : query(collection(db, 'company_docs'), where('status', '==', 'published'));

    const unsubCompanyDocs = onSnapshot(
      companyDocsQuery,
      (snap) => {
        const docs: StoredCompanyDoc[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            authorUid: String(data.authorUid || ''),
            title: String(data.title || ''),
            category: (data.category as CompanyDocCategory) || 'quality_standard',
            content: String(data.content || ''),
            status: data.status === 'archived' ? 'archived' : 'published',
            createdAt: formatTimestamp(data.createdAt),
            updatedAt: formatTimestamp(data.updatedAt)
          };
        });
        docs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setCompanyDocs(docs.length > 0 ? docs : INITIAL_COMPANY_AUDIT_DOCS);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'company_docs');
        } catch (reportedErr) {
          console.warn(reportedErr);
        }
      }
    );

    // 4. Super Admin Cross-User Audit Results Fetcher
    let unsubAdminUsers: (() => void) | null = null;
    if (isAdmin) {
      unsubAdminUsers = onSnapshot(
        collection(db, 'users'),
        async (usersSnap) => {
          const profiles: StoredUserProfile[] = [];
          const allInteractions: StoredAuditInteraction[] = [];

          for (const userDoc of usersSnap.docs) {
            const pData = userDoc.data();
            profiles.push({
              uid: userDoc.id,
              displayName: String(pData.displayName || 'Employee'),
              jobRole: String(pData.jobRole || 'Role'),
              department: String(pData.department || 'Department'),
              jobDescription: String(pData.jobDescription || ''),
              createdAt: formatTimestamp(pData.createdAt),
              updatedAt: formatTimestamp(pData.updatedAt)
            });

            try {
              const intSnap = await getDocs(
                collection(db, 'users', userDoc.id, 'interactions')
              );
              for (const iDoc of intSnap.docs) {
                const iData = iDoc.data();
                allInteractions.push({
                  id: iDoc.id,
                  userId: String(iData.userId || userDoc.id),
                  sessionId: String(iData.sessionId || 'sess_default'),
                  category:
                    (iData.category as InteractionCategory) || 'general_reflection',
                  userPrompt: String(iData.userPrompt || ''),
                  aiResponse: String(iData.aiResponse || ''),
                  executiveSummary: String(iData.executiveSummary || ''),
                  brainstormingIdeas: String(iData.brainstormingIdeas || ''),
                  auditAlignment: String(iData.auditAlignment || ''),
                  severityLevel: iData.severityLevel || 'medium',
                  userRoleSnapshot: String(iData.userRoleSnapshot || ''),
                  userNameSnapshot: String(iData.userNameSnapshot || ''),
                  createdAt: formatTimestamp(iData.createdAt)
                });
              }
            } catch (subErr) {
              console.warn('Admin subcollection read notice:', subErr);
            }
          }

          allInteractions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setAllAdminProfiles(
            profiles.length > 0 ? profiles : [INITIAL_DEMO_PROFILE]
          );
          setAllAdminInteractions(
            allInteractions.length > 0 ? allInteractions : INITIAL_DEMO_INTERACTIONS
          );
        },
        (err) => {
          try {
            handleFirestoreError(err, OperationType.LIST, 'users');
          } catch (reportedErr) {
            console.warn(reportedErr);
          }
        }
      );
    }

    return () => {
      unsubProfile();
      unsubInteractions();
      unsubCompanyDocs();
      if (unsubAdminUsers) unsubAdminUsers();
    };
  }, [isAuthReady, firebaseUser]);

  // Handlers
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Google Sign-In failed or was cancelled.';
      setAuthError(msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setPendingRetryAction(null);
    if (firebaseUser) {
      await signOut(auth);
    }
    setDemoRole('none');
  };

  const handleStartDemoMode = (role: 'employee' | 'admin') => {
    setAuthError(null);
    setDemoRole(role);
    setActiveWorkspace(role === 'admin' ? 'super_admin' : 'employee_dashboard');
  };

  // Save User Profile with Strict Sanitization & Transaction Verification
  const handleSaveProfile = useCallback(
    async (profileData: {
      displayName: string;
      jobRole: string;
      department: string;
      jobDescription: string;
    }) => {
      const cleanData = stripUndefined({
        uid: currentUid,
        displayName: profileData.displayName.trim(),
        jobRole: profileData.jobRole.trim(),
        department: profileData.department.trim(),
        jobDescription: profileData.jobDescription.trim()
      });

      const persistOperation = async () => {
        if (firebaseUser) {
          const profileRef = doc(db, 'users', firebaseUser.uid);
          try {
            const existingSnap = await getDoc(profileRef);
            if (existingSnap.exists()) {
              await updateDoc(
                profileRef,
                stripUndefined({
                  displayName: cleanData.displayName,
                  jobRole: cleanData.jobRole,
                  department: cleanData.department,
                  jobDescription: cleanData.jobDescription,
                  updatedAt: serverTimestamp()
                })
              );
            } else {
              await setDoc(
                profileRef,
                stripUndefined({
                  ...cleanData,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                })
              );
            }
          } catch (err) {
            handleFirestoreError(
              err,
              OperationType.WRITE,
              `users/${firebaseUser.uid}`
            );
          }
        } else {
          const nowIso = new Date().toISOString();
          const updatedProfile: StoredUserProfile = {
            ...cleanData,
            createdAt: userProfile?.createdAt || nowIso,
            updatedAt: nowIso
          };
          setUserProfile(updatedProfile);
          setAllAdminProfiles((prev) => {
            const filtered = prev.filter((p) => p.uid !== updatedProfile.uid);
            return [updatedProfile, ...filtered];
          });
        }
        setPendingRetryAction(null);
      };

      try {
        await persistOperation();
      } catch (err) {
        setPendingRetryAction({
          message:
            'Could not verify profile write to Cloud Firestore. Your changes are still buffered in the form.',
          onRetry: persistOperation
        });
        throw err;
      }
    },
    [currentUid, firebaseUser, userProfile]
  );

  // Submit Multi-Turn Audit Interaction to Gemini 3.6 Flash + Persist to Firestore
  const handleSubmitInteraction = useCallback(
    async (params: {
      sessionId: string;
      category: InteractionCategory;
      userPrompt: string;
    }) => {
      if (!userProfile) {
        throw new Error('Please configure your Professional Background first.');
      }

      const priorTurns = userInteractions
        .filter((i) => i.sessionId === params.sessionId)
        .slice(0, 6)
        .reverse();

      const response = await fetch('/api/audit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: params.userPrompt,
          category: params.category,
          jobRole: userProfile.jobRole,
          department: userProfile.department,
          jobDescription: userProfile.jobDescription,
          conversationHistory: priorTurns,
          companyDocs: companyDocs.filter((d) => d.status === 'published')
        })
      });

      const aiData = await response.json();
      if (!response.ok) {
        throw new Error(aiData.error || 'Gemini audit analysis failed.');
      }

      const interactionId = `int_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;

      const rawPayload = stripUndefined({
        userId: currentUid,
        sessionId: params.sessionId,
        category: params.category,
        userPrompt: params.userPrompt,
        aiResponse: String(aiData.aiResponse || ''),
        executiveSummary: String(aiData.executiveSummary || ''),
        brainstormingIdeas: String(aiData.brainstormingIdeas || ''),
        auditAlignment: String(aiData.auditAlignment || ''),
        severityLevel: aiData.severityLevel || 'medium',
        userRoleSnapshot: `${userProfile.jobRole} · ${userProfile.department}`.slice(
          0,
          250
        ),
        userNameSnapshot: userProfile.displayName.slice(0, 120)
      });

      const validation = validateAuditInteractionPayload(rawPayload);
      if (!validation.valid || !validation.sanitized) {
        throw new Error(validation.errors.join(' '));
      }

      const sanitizedPayload = validation.sanitized;

      const saveInteractionToDb = async () => {
        if (firebaseUser) {
          // Ensure parent user profile exists in Firestore before writing interaction (Master Gate)
          const profileRef = doc(db, 'users', firebaseUser.uid);
          const profileSnap = await getDoc(profileRef);
          if (!profileSnap.exists()) {
            await setDoc(
              profileRef,
              stripUndefined({
                uid: firebaseUser.uid,
                displayName: userProfile.displayName,
                jobRole: userProfile.jobRole,
                department: userProfile.department,
                jobDescription: userProfile.jobDescription,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              })
            );
          }

          const intRef = doc(
            db,
            'users',
            firebaseUser.uid,
            'interactions',
            interactionId
          );
          try {
            await setDoc(
              intRef,
              stripUndefined({
                ...sanitizedPayload,
                createdAt: serverTimestamp()
              })
            );
          } catch (err) {
            handleFirestoreError(
              err,
              OperationType.CREATE,
              `users/${firebaseUser.uid}/interactions/${interactionId}`
            );
          }
        } else {
          const newEntry: StoredAuditInteraction = {
            id: interactionId,
            ...sanitizedPayload,
            createdAt: new Date().toISOString()
          };
          setUserInteractions((prev) => [newEntry, ...prev]);
          setAllAdminInteractions((prev) => [newEntry, ...prev]);
        }
        setPendingRetryAction(null);
      };

      try {
        await saveInteractionToDb();
      } catch (dbErr) {
        setPendingRetryAction({
          message:
            'Gemini generated your audit reflection, but saving to Cloud Firestore encountered an error. Click "Retry Save" to persist this interaction without re-running generation.',
          onRetry: saveInteractionToDb
        });
        throw dbErr;
      }
    },
    [companyDocs, currentUid, firebaseUser, userInteractions, userProfile]
  );

  const handleDeleteInteraction = useCallback(
    async (interactionId: string) => {
      if (firebaseUser) {
        try {
          await deleteDoc(
            doc(db, 'users', firebaseUser.uid, 'interactions', interactionId)
          );
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.DELETE,
            `users/${firebaseUser.uid}/interactions/${interactionId}`
          );
        }
      } else {
        setUserInteractions((prev) => prev.filter((i) => i.id !== interactionId));
        setAllAdminInteractions((prev) => prev.filter((i) => i.id !== interactionId));
      }
    },
    [firebaseUser]
  );

  // Super Admin Handlers
  const handleCreateCompanyDoc = useCallback(
    async (docData: {
      title: string;
      category: CompanyDocCategory;
      content: string;
      status: 'published' | 'archived';
    }) => {
      const docId = `doc_${Date.now().toString(36)}`;
      const cleanPayload = stripUndefined({
        authorUid: currentUid,
        title: docData.title.trim(),
        category: docData.category,
        content: docData.content.trim(),
        status: docData.status
      });

      const persistDoc = async () => {
        if (firebaseUser) {
          try {
            await setDoc(
              doc(db, 'company_docs', docId),
              stripUndefined({
                ...cleanPayload,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              })
            );
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `company_docs/${docId}`);
          }
        } else {
          const nowIso = new Date().toISOString();
          const created: StoredCompanyDoc = {
            id: docId,
            ...cleanPayload,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          setCompanyDocs((prev) => [created, ...prev]);
        }
        setPendingRetryAction(null);
      };

      try {
        await persistDoc();
      } catch (err) {
        setPendingRetryAction({
          message:
            'Failed to persist Company Audit Basis document to Firestore. Click "Retry Save" to complete.',
          onRetry: persistDoc
        });
        throw err;
      }
    },
    [currentUid, firebaseUser]
  );

  const handleToggleCompanyDocStatus = useCallback(
    async (docId: string, nextStatus: 'published' | 'archived') => {
      if (firebaseUser) {
        try {
          await updateDoc(
            doc(db, 'company_docs', docId),
            stripUndefined({
              status: nextStatus,
              updatedAt: serverTimestamp()
            })
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `company_docs/${docId}`);
        }
      } else {
        setCompanyDocs((prev) =>
          prev.map((d) =>
            d.id === docId
              ? { ...d, status: nextStatus, updatedAt: new Date().toISOString() }
              : d
          )
        );
      }
    },
    [firebaseUser]
  );

  const handleDeleteCompanyDoc = useCallback(
    async (docId: string) => {
      if (firebaseUser) {
        try {
          await deleteDoc(doc(db, 'company_docs', docId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `company_docs/${docId}`);
        }
      } else {
        setCompanyDocs((prev) => prev.filter((d) => d.id !== docId));
      }
    },
    [firebaseUser]
  );

  const handleSeedDefaultCompanyDocs = useCallback(async () => {
    if (firebaseUser) {
      for (const item of INITIAL_COMPANY_AUDIT_DOCS) {
        try {
          await setDoc(
            doc(db, 'company_docs', item.id),
            stripUndefined({
              authorUid: firebaseUser.uid,
              title: item.title,
              category: item.category,
              content: item.content,
              status: 'published',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            })
          );
        } catch (err) {
          console.warn('Seed doc warning:', err);
        }
      }
    } else {
      setCompanyDocs(INITIAL_COMPANY_AUDIT_DOCS);
    }
  }, [firebaseUser]);

  // Show Landing View when neither authenticated nor in interactive preview mode
  if (!isLiveAuthenticated && demoRole === 'none') {
    return (
      <>
        <LandingView
          onGoogleSignIn={handleGoogleSignIn}
          onStartDemoMode={handleStartDemoMode}
          onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
          isSigningIn={isSigningIn}
          authError={authError}
        />
        <SecurityWalkthroughModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar Navigation (264px width per SaaS Dashboard Reference) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[264px] bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0 justify-between">
        <div className="p-5 space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <span className="text-base font-bold tracking-tight text-white block">
              AuditPulse AI
            </span>
            <span className="text-xs text-slate-400 block mt-0.5">
              Enterprise Quality Governance
            </span>
          </div>

          <nav aria-label="Workspace Navigation" className="space-y-1.5">
            <button
              type="button"
              onClick={() => setActiveWorkspace('employee_dashboard')}
              className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${
                activeWorkspace === 'employee_dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Private Employee Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isEffectiveSuperAdmin && !isLiveAuthenticated) {
                  setDemoRole('admin');
                }
                setActiveWorkspace('super_admin');
              }}
              className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${
                activeWorkspace === 'super_admin'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Super Admin Console</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSecurityModalOpen(true)}
              className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-lg flex items-center gap-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Threat Model & Test Cases</span>
            </button>
          </nav>

          {/* Role & Isolation Status Card */}
          <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-white font-semibold">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{currentDisplayName}</span>
            </div>
            <p className="text-slate-400 font-mono text-[11px] break-all">
              {currentEmail}
            </p>
            <p className="text-slate-300 text-[11px] pt-1 border-t border-slate-700">
              {isEffectiveSuperAdmin
                ? 'Privilege: Verified Super Admin'
                : 'Privilege: Isolated Employee Scope'}
            </p>
          </div>
        </div>

        <div className="p-5 border-t border-slate-800 space-y-2">
          {!isLiveAuthenticated && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 rounded-lg transition-colors cursor-pointer"
            >
              Sign In with Live Google SSO
            </button>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isLiveAuthenticated ? 'Sign Out' : 'Exit Workspace Preview'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Workspace Top Header (SaaS Top Bar Contract: Breadcrumb left, 1-2 primary actions right) */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              {isMobileSidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>

            <div className="flex items-center gap-2 text-sm text-slate-600 truncate">
              <span className="font-bold text-slate-900">AuditPulse AI</span>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-slate-900 truncate">
                {activeWorkspace === 'super_admin'
                  ? 'Super Admin Governance Console'
                  : 'Private Employee Quality Audit Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                setActiveWorkspace(
                  activeWorkspace === 'super_admin'
                    ? 'employee_dashboard'
                    : 'super_admin'
                )
              }
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {activeWorkspace === 'super_admin'
                ? 'Switch to Employee Dashboard'
                : 'Switch to Super Admin View'}
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isLiveAuthenticated ? 'Sign Out' : 'Back to Landing'}
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {isMobileSidebarOpen && (
          <div className="lg:hidden bg-slate-900 text-white px-6 py-4 space-y-2 border-b border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveWorkspace('employee_dashboard');
                setIsMobileSidebarOpen(false);
              }}
              className="block w-full text-left py-2 text-xs font-semibold text-slate-200 hover:text-white"
            >
              Private Employee Dashboard
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isEffectiveSuperAdmin && !isLiveAuthenticated) {
                  setDemoRole('admin');
                }
                setActiveWorkspace('super_admin');
                setIsMobileSidebarOpen(false);
              }}
              className="block w-full text-left py-2 text-xs font-semibold text-slate-200 hover:text-white"
            >
              Super Admin Console ({SUPER_ADMIN_EMAIL})
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSecurityModalOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              className="block w-full text-left py-2 text-xs font-semibold text-slate-200 hover:text-white"
            >
              Threat Model & Test Cases
            </button>
          </div>
        )}

        {/* Workspace Viewport */}
        <main className="flex-1 max-w-[1280px] w-full mx-auto p-6">
          {activeWorkspace === 'super_admin' ? (
            isLiveAuthenticated && !isEffectiveSuperAdmin ? (
              <div
                role="alert"
                className="bg-white border border-slate-200 rounded-xl p-8 max-w-xl mx-auto text-center space-y-4"
              >
                <h2 className="text-lg font-bold text-slate-900">
                  Super Administrator Access Restricted
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  You are currently authenticated as{' '}
                  <span className="font-mono font-semibold text-slate-900">
                    {currentEmail}
                  </span>
                  . Super Administrator privileges (uploading Company Audit Basis
                  standards and reviewing cross-user audit findings) are strictly
                  reserved for the designated Super Administrator:{' '}
                  <span className="font-mono font-semibold text-blue-800">
                    {SUPER_ADMIN_EMAIL}
                  </span>
                  .
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveWorkspace('employee_dashboard')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    Return to Your Private Dashboard
                  </button>
                </div>
              </div>
            ) : (
              <SuperAdminView
                adminUid={currentUid}
                adminEmail={
                  isEffectiveSuperAdmin ? SUPER_ADMIN_EMAIL : currentEmail
                }
                companyDocs={companyDocs}
                allUserInteractions={allAdminInteractions}
                allUserProfiles={allAdminProfiles}
                onCreateCompanyDoc={handleCreateCompanyDoc}
                onToggleCompanyDocStatus={handleToggleCompanyDocStatus}
                onDeleteCompanyDoc={handleDeleteCompanyDoc}
                onSeedDefaultCompanyDocs={handleSeedDefaultCompanyDocs}
                pendingRetryAction={pendingRetryAction}
                onDismissRetry={() => setPendingRetryAction(null)}
              />
            )
          ) : (
            <UserDashboardView
              currentUserUid={currentUid}
              currentUserEmail={currentEmail}
              currentUserName={currentDisplayName}
              profile={userProfile}
              interactions={userInteractions}
              companyDocs={companyDocs}
              onSaveProfile={handleSaveProfile}
              onSubmitInteraction={handleSubmitInteraction}
              onDeleteInteraction={handleDeleteInteraction}
              pendingRetryAction={pendingRetryAction}
              onDismissRetry={() => setPendingRetryAction(null)}
            />
          )}
        </main>
      </div>

      <SecurityWalkthroughModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />
    </div>
  );
}
