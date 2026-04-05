import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithGoogle } from '../firebase';
import { Building2, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      console.error('Login failed:', err);
      setError('Falha ao entrar com Google. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-slate-900 rounded-2xl shadow-2xl p-8 border border-slate-800"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-900/20 rounded-2xl text-blue-500 mb-4">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Imobiliária Pro</h1>
          <p className="text-slate-400 mt-2">Gestão completa de aluguéis e contratos</p>
        </div>

        {error && (
          <div className="bg-red-900/20 text-red-400 p-4 rounded-lg text-sm mb-6 border border-red-900/30 text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-slate-800 border border-slate-700 text-slate-100 font-semibold py-3 px-4 rounded-xl hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Entrar com Google
            </>
          )}
        </button>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            Ao entrar, você concorda com nossos termos de uso e política de privacidade.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
