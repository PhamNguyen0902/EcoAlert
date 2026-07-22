import { motion } from 'framer-motion';
import { ArrowRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const MOCK_NEWS = [
  {
    id: '1',
    title: 'New Environmental Policies Implemented in Ho Chi Minh City',
    description: 'City officials have announced strict new regulations targeting industrial emissions and illegal waste dumping in suburban areas to combat rising pollution levels.',
    image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=600',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    source: 'EcoAlert Times'
  },
  {
    id: '2',
    title: 'Community Cleanup Drive Removes 5 Tons of Plastic',
    description: 'Over 500 volunteers gathered this weekend to clean up the local riverfront, successfully removing 5 tons of plastic waste and raising awareness about water pollution.',
    image: 'https://images.unsplash.com/photo-1618477461853-cf6ed80fbea5?auto=format&fit=crop&q=80&w=600',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    source: 'Green Vietnam'
  },
  {
    id: '3',
    title: 'AI-Powered Air Quality Monitors Installed Across Districts',
    description: 'A new network of AI-powered IoT sensors has been deployed across 15 districts to provide real-time, highly accurate air quality indexing for residents.',
    image: 'https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?auto=format&fit=crop&q=80&w=600',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    source: 'Tech & Environment'
  },
  {
    id: '4',
    title: 'Sustainable Transport Initiative Gaining Momentum',
    description: 'The recent push for electric public transport has seen a 30% increase in ridership, contributing to a measurable decrease in urban smog levels this quarter.',
    image: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&q=80&w=600',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    source: 'Urban Planning Weekly'
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export function NewsSection() {
  return (
    <section className="py-16 bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
              Environmental News
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Stay updated on the latest environmental initiatives and alerts
            </p>
          </div>
          <button className="hidden sm:flex items-center text-primary hover:text-primary/80 font-medium transition-colors">
            View All News <ArrowRight className="ml-2 w-4 h-4" />
          </button>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8"
        >
          {MOCK_NEWS.map((news) => (
            <motion.article 
              key={news.id} 
              variants={itemVariants}
              className="flex flex-col bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="h-48 overflow-hidden">
                <img 
                  src={news.image} 
                  alt={news.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <span className="font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                    {news.source}
                  </span>
                  <span className="mx-2">•</span>
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  {format(new Date(news.publishedAt), 'MMM d, yyyy')}
                </div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2 leading-tight">
                  {news.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2 flex-1">
                  {news.description}
                </p>
                <button className="flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-auto">
                  Read More <ArrowRight className="ml-1 w-4 h-4" />
                </button>
              </div>
            </motion.article>
          ))}
        </motion.div>
        
        <div className="mt-8 text-center sm:hidden">
          <button className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-slate-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 w-full transition-colors">
            View All News
          </button>
        </div>
      </div>
    </section>
  );
}
