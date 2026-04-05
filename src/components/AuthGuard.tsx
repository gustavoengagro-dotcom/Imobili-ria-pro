import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        if (location.pathname !== '/login') {
          navigate('/login');
        }
      } else {
        // Ensure user document exists in Firestore
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            const isDefaultAdmin = currentUser.email === 'gustavo.eng.agro@gmail.com';
            await setDoc(userRef, {
              email: currentUser.email || '',
              role: isDefaultAdmin ? 'admin' : 'user',
              displayName: currentUser.displayName || '',
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error ensuring user profile:', error);
          // We don't block here, the onSnapshot will handle state
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          setProfile({ uid: user.uid, ...snapshot.data() } as UserProfile);
        } else {
          // Fallback if document creation is still in progress or failed
          setProfile({ uid: user.uid, email: user.email || '', role: user.email === 'gustavo.eng.agro@gmail.com' ? 'admin' : 'user', displayName: user.displayName || '' });
        }
        setLoading(false);
      }, (error) => {
        // If we get a permission error here, it might be because the document doesn't exist yet
        // and rules are strict. We'll handle it gracefully.
        if (user.email === 'gustavo.eng.agro@gmail.com') {
          setProfile({ uid: user.uid, email: user.email, role: 'admin', displayName: user.displayName || '' });
        }
        setLoading(false);
      });

      return () => unsubscribeProfile();
    }
  }, [user]);

  const isAdmin = profile?.role === 'admin' || user?.email === 'gustavo.eng.agro@gmail.com';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [user, loading, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user && location.pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
};
