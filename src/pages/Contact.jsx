import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Contact Us | MuviDB';
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    setTimeout(() => {
      toast.success('Message sent successfully! We will get back to you soon.');
      setFormData({ name: '', email: '', message: '' });
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="max-w-3xl mx-auto px-4 py-32">
        <h1 className="text-4xl md:text-6xl font-heading font-black tracking-tighter mb-4">
          Contact <span className="text-brand">Us</span>
        </h1>
        <p className="text-text-muted text-lg mb-12">
          Have a question, suggestion, or just want to say hi? We'd love to hear from you.
        </p>

        <div className="grid md:grid-cols-3 gap-12">
          <div className="md:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-bold mb-2">Name</label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-brand transition-colors"
                  placeholder="Your name"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-bold mb-2">Email</label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-brand transition-colors"
                  placeholder="you@example.com"
                />
              </div>
              
              <div>
                <label htmlFor="message" className="block text-sm font-bold mb-2">Message</label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-brand transition-colors resize-none"
                  placeholder="How can we help you?"
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand text-white font-bold px-8 py-4 rounded-lg hover:shadow-brand/20 transition-all disabled:opacity-50 flex items-center justify-center min-w-[150px]"
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
          
          <div className="space-y-8">
            <div>
              <h3 className="font-heading font-bold text-xl mb-4">Connect</h3>
              <div className="space-y-4">
                <a 
                  href="https://twitter.com/muvidb_" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-text-muted hover:text-brand transition-colors font-bold"
                >
                  <span>𝕏</span>
                  @muvidb_
                </a>
                <a 
                  href="https://instagram.com/muvidb_" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-text-muted hover:text-brand transition-colors font-bold"
                >
                  <span>IG</span>
                  @muvidb_
                </a>
              </div>
            </div>
            
            <div>
              <h3 className="font-heading font-bold text-xl mb-4">Support</h3>
              <p className="text-text-muted text-sm leading-relaxed">
                For technical issues or account support, please include your registered email address in your message.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
