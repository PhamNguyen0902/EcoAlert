import { motion } from 'framer-motion';
import { FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import type { Alert } from '@/types';

import { useLanguage } from '@/contexts/LanguageContext';

export function StatsSection({ alerts }: { alerts: Alert[] }) {
  const { t } = useLanguage();
  const totalReports = alerts?.length || 0;
  const resolved = alerts?.filter(a => a.status === 'resolved').length || 0;
  const pending = alerts?.filter(a => a.status === 'pending' || a.status === 'in_progress').length || 0;
  const critical = alerts?.filter(a => a.severity === 'critical').length || 0;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <section className="py-16 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center sm:text-left">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl mb-4">
            {t('stats.environmental_overview')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
            {t('stats.community_snapshot')}
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          <motion.div variants={itemVariants}>
            <StatCard
              title={t('stats.total_reports')}
              value={totalReports}
              icon={FileText}
              trend={{ value: 12, isPositive: true }}
              className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-slate-900 border-blue-100 dark:border-blue-900"
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <StatCard
              title={t('stats.resolved')}
              value={resolved}
              icon={CheckCircle}
              trend={{ value: 8, isPositive: true }}
              className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-900 border-emerald-100 dark:border-emerald-900"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <StatCard
              title={t('stats.pending_verification')}
              value={pending}
              icon={Clock}
              trend={{ value: 3, isPositive: false }}
              className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-900 border-amber-100 dark:border-amber-900"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <StatCard
              title="Critical Alerts"
              value={critical}
              icon={AlertTriangle}
              trend={{ value: 2, isPositive: false }}
              className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/40 dark:to-slate-900 border-red-100 dark:border-red-900"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
