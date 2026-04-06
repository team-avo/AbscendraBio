"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Barlow } from "next/font/google";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

const testimonials = [
  { id: 1, name: "Dr. Paul Somano", title: "New Smyrna Beach Family Practice", company: "New Smyrna Beach Family Practice", rating: 5, text: "I have been so happy since switching to a Lab from a pharmacy. When I used pharmacies I had to order for particular patients. Then it took however long it took to get the medication for the patient. Tedious and time consuming. Patients frequently ran out of medicine. Now I order a sufficient quantity and it’s there the next day, two max. Almost impossible to match that level of service. I have never once had a late order from centre labs. Never. Not one. I have yet had to apologize to a patient for not having their medications. This was not the case with multiple prior suppliers. Superior products at competitive prices with excellent customer service. My patients expect that and I deserve it. Centre delivers it.", image: "https://images.unsplash.com/photo-1618053448748-b7251851d014?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", labBackground: "https://images.unsplash.com/photo-1739515054273-a2956b1e094a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
  { id: 2, name: "Dr. Aleksandra Gajer", title: "The Gajer Practice", company: "The Gajer Practice", rating: 5, text: "Centre Labs peptides have significantly upleveled my practice. They are truly the highest quality peptides that have been game-changers in my patients’ health. Ben and Nick are incredible to work with and I couldn’t ask for a better partnership!", image: "https://images.unsplash.com/photo-1618053448748-b7251851d014?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", labBackground: "https://images.unsplash.com/photo-1739515054273-a2956b1e094a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
  // { id: 3, name: "Dr. Emily Watson", title: "Senior Scientist", company: "Johns Hopkins University", rating: 5, text: "The customer service team is incredibly knowledgeable and responsive.", image: "https://images.unsplash.com/photo-1618053448748-b7251851d014?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", labBackground: "https://images.unsplash.com/photo-1739515054273-a2956b1e094a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
];

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCurrentIndex((prev) => (prev + 1) % testimonials.length), 5000);
    return () => clearInterval(timer);
  }, []);
  const nextTestimonial = () => setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  const prevTestimonial = () => setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);

  return (
    <section className="py-20 bg-background relative overflow-hidden" suppressHydrationWarning>
      <div className="absolute inset-0">
        <motion.div className="absolute inset-0 opacity-0" />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-16">
          <h2 className={`text-5xl font-bold text-foreground mb-4 ${barlow.className}`}>What Doctors Say</h2>
        </motion.div>

        <div className="relative">
          <div className="overflow-hidden rounded-3xl relative">
            <motion.div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
              {testimonials.map((testimonial) => (
                <div key={testimonial.id} className="w-full flex-shrink-0">
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} whileHover={{ scale: 1.02 }} className="relative group">
                    <div className="relative backdrop-blur-2xl bg-card/50 border border-border rounded-3xl p-12 mx-4 overflow-hidden">
                      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-black/10" />
                      <motion.div className="absolute top-8 left-8 w-16 h-16 bg-card/70 rounded-full flex items-center justify-center backdrop-blur-sm border border-border" animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                        <Quote className="w-8 h-8 text-muted-foreground" />
                      </motion.div>
                      <div className="relative z-10 text-center">
                        <div className="flex justify-center gap-1 mb-6">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <motion.div key={i} animate={{ scale: [1, 1.2, 1], rotate: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}>
                              <Star className="w-6 h-6 text-yellow-500 fill-current" />
                            </motion.div>
                          ))}
                        </div>
                        <motion.p className="text-xl text-foreground mb-8 max-w-3xl mx-auto leading-relaxed" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
                          "{testimonial.text}"
                        </motion.p>
                        <div className="flex items-center justify-center gap-6">
                          <div className="text-center">
                            <motion.h4 className="text-lg font-bold text-foreground mb-1">{testimonial.name}</motion.h4>
                            <p className="text-green-600 font-medium">{testimonial.title}</p>
                            {/* <p className="text-muted-foreground text-sm">{testimonial.company}</p> */}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              ))}
            </motion.div>

            {/* Vertically centered arrow wrappers pinned to container edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
              <Button onClick={prevTestimonial} className="pointer-events-auto w-12 h-12 md:w-14 md:h-14 rounded-full bg-card/70 hover:bg-card border border-border backdrop-blur-sm transition-all duration-300 group" size="icon">
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-foreground group-hover:text-green-600 transition-colors duration-300" />
              </Button>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <Button onClick={nextTestimonial} className="pointer-events-auto w-12 h-12 md:w-14 md:h-14 rounded-full bg-card/70 hover:bg-card border border-border backdrop-blur-sm transition-all duration-300 group" size="icon">
                <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-foreground group-hover:text-green-600 transition-colors duration-300" />
              </Button>
            </div>
          </div>

          <div className="flex justify-center gap-3 mt-12">
            {testimonials.map((_, index) => (
              <button key={index} onClick={() => setCurrentIndex(index)} className="relative group">
                <div className={`w-4 h-4 rounded-full transition-all duration-300 ${index === currentIndex ? "bg-foreground scale-125" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`} />
                {index === currentIndex && (
                  <motion.div className="absolute inset-0 rounded-full bg-foreground blur-md opacity-20" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;


