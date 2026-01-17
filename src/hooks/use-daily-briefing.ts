import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTasksQuery } from "./useTasksQuery";
import { supabase } from "@/integrations/supabase/client";

interface WeatherData {
  temp: number;
  conditionCode: number;
}

interface DailyBriefingData {
  greeting: string;
  focus: number;
  insight: string | null;
  context: string | null;
  reminder: number;
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to generate daily briefing data from tasks
 * 
 * Features:
 * - Time-based greeting with user's first name
 * - Count of tasks due today (Focus)
 * - Count of urgent tasks (Insight)
 * - Most frequent property (Context)
 * - Count of recurring tasks (Reminder)
 * - Local weather from open-meteo.com
 * 
 * @param providedTasks - Optional array of tasks to use instead of fetching all tasks
 */
export function useDailyBriefing(providedTasks?: any[]): DailyBriefingData {
  const { data: allTasks = [], isLoading: tasksLoading } = useTasksQuery();
  const tasks = providedTasks !== undefined ? providedTasks : allTasks;
  const [userFirstName, setUserFirstName] = useState<string>("");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Humanize user name from metadata or email
  const humanizeName = (email: string): string => {
    // Extract the local part (before @)
    const localPart = email.split('@')[0];
    
    // Remove special characters like +, numbers, and common separators
    let cleaned = localPart
      .replace(/\+.*$/, '') // Remove everything after +
      .replace(/[0-9]/g, '') // Remove numbers
      .replace(/[._-]/g, '') // Remove dots, underscores, hyphens
      .toLowerCase();
    
    // Capitalize first letter
    if (cleaned.length > 0) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    return "there";
  };

  // Fetch user first name
  useEffect(() => {
    async function fetchUserFirstName() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        
        if (user) {
          // Priority 1: Check user_metadata for nickname
          const nickname = user.user_metadata?.nickname;
          
          if (nickname) {
            setUserFirstName(nickname);
            return;
          }
          
          // Priority 2: Check user_metadata for first_name or full_name
          const firstName = user.user_metadata?.first_name || 
                           user.user_metadata?.full_name?.split(' ')[0] ||
                           user.user_metadata?.firstName ||
                           user.user_metadata?.name?.split(' ')[0];
          
          if (firstName) {
            setUserFirstName(firstName);
            return;
          }
          
          // Priority 3: Parse and clean email
          if (user.email) {
            const cleanedName = humanizeName(user.email);
            setUserFirstName(cleanedName);
            return;
          }
          
          // Fallback
          setUserFirstName("there");
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        setUserFirstName("there");
      }
    }
    
    fetchUserFirstName();
  }, []);

  // Get time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting: string;
    
    if (hour < 12) {
      timeGreeting = "Good morning";
    } else if (hour < 17) {
      timeGreeting = "Good afternoon";
    } else {
      timeGreeting = "Good evening";
    }
    
    return `${timeGreeting}, ${userFirstName}`;
  }, [userFirstName]);

  // Count tasks due today (Focus)
  const focus = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return tasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today && dueDate < tomorrow;
    }).length;
  }, [tasks]);

  // Count urgent tasks (Insight)
  const insight = useMemo(() => {
    const urgentCount = tasks.filter(task => task.priority === 'urgent').length;
    if (urgentCount > 0) {
      return `${urgentCount} urgent ${urgentCount === 1 ? 'item' : 'items'} need action.`;
    }
    return null;
  }, [tasks]);

  // Find most frequent property (Context)
  const context = useMemo(() => {
    if (tasks.length === 0) return null;
    
    // Group tasks by property_id
    const propertyCounts = new Map<string, number>();
    const propertyNames = new Map<string, string>();
    
    tasks.forEach(task => {
      if (task.property_id) {
        const count = propertyCounts.get(task.property_id) || 0;
        propertyCounts.set(task.property_id, count + 1);
        
        // Store property name if available
        if (task.property_name && !propertyNames.has(task.property_id)) {
          propertyNames.set(task.property_id, task.property_name);
        } else if (task.property_address && !propertyNames.has(task.property_id)) {
          propertyNames.set(task.property_id, task.property_address);
        }
      }
    });
    
    if (propertyCounts.size === 0) return null;
    
    // Find the mode (most frequent)
    let maxCount = 0;
    let modePropertyId: string | null = null;
    
    propertyCounts.forEach((count, propertyId) => {
      if (count > maxCount) {
        maxCount = count;
        modePropertyId = propertyId;
      }
    });
    
    if (modePropertyId) {
      const propertyName = propertyNames.get(modePropertyId) || "your properties";
      return `Most tasks relate to ${propertyName}.`;
    }
    
    return null;
  }, [tasks]);

  // Count recurring tasks (Reminder)
  // Recurrence is stored in metadata.repeat (RepeatRule) or in task_recurrence table
  const reminder = useMemo(() => {
    return tasks.filter(task => {
      // Check if task has recurrence in metadata
      if (task.metadata && typeof task.metadata === 'object') {
        const metadata = task.metadata as any;
        if (metadata.repeat || metadata.recurrence_rule) {
          return true;
        }
      }
      // Also check for recurrence_rule field directly (if it exists)
      return (task as any).recurrence_rule != null;
    }).length;
  }, [tasks]);

  // Fetch weather from open-meteo.com
  useEffect(() => {
    async function fetchWeather() {
      try {
        // If the user has previously denied location, don't prompt again.
        // (Browsers generally won't re-prompt, but repeated calls still produce noisy errors.)
        const GEO_DENIED_KEY = "filla_geo_denied";
        if (localStorage.getItem(GEO_DENIED_KEY) === "1") {
          setWeatherError("Location access denied");
          return;
        }

        // If Permissions API is available, respect an already-denied state up front.
        // @ts-expect-error - Permissions API types vary across TS lib configs
        if (navigator.permissions?.query) {
          try {
            // @ts-expect-error - 'geolocation' is a valid permission name in browsers
            const perm = await navigator.permissions.query({ name: "geolocation" });
            if (perm?.state === "denied") {
              localStorage.setItem(GEO_DENIED_KEY, "1");
              setWeatherError("Location access denied");
              return;
            }
          } catch {
            // Ignore permission query errors; fall back to getCurrentPosition
          }
        }

        // Get user's location from browser
        if (!navigator.geolocation) {
          setWeatherError("Geolocation not supported");
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            try {
              // Fetch current weather from open-meteo.com
              const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`
              );
              
              if (!response.ok) {
                throw new Error("Weather API request failed");
              }
              
              const data = await response.json();
              
              if (data.current) {
                setWeather({
                  temp: Math.round(data.current.temperature_2m),
                  conditionCode: data.current.weather_code,
                });
              }
            } catch (err) {
              console.error("Error fetching weather:", err);
              setWeatherError("Failed to fetch weather");
            }
          },
          (error) => {
            // Permission denied
            if (error?.code === 1) {
              localStorage.setItem(GEO_DENIED_KEY, "1");
              setWeatherError("Location access denied");
              return;
            }

            console.error("Geolocation error:", error);
            setWeatherError("Geolocation error");
          }
        );
      } catch (err) {
        console.error("Error setting up geolocation:", err);
        setWeatherError("Geolocation error");
      }
    }
    
    fetchWeather();
  }, []);

  return {
    greeting,
    focus,
    insight,
    context,
    reminder,
    weather,
    loading: tasksLoading,
    error: weatherError,
  };
}

