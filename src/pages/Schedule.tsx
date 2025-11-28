import { useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { mockTasks, mockProperties } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { Calendar as CalendarIcon, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Task } from '@/types/task';

const getStatusColor = (status: Task['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-success text-success-foreground';
    case 'in-progress':
      return 'bg-warning text-warning-foreground';
    case 'pending':
      return 'bg-primary text-primary-foreground';
  }
};

const Schedule = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const navigate = useNavigate();

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const tasksOnSelectedDate = mockTasks.filter(task => 
    isSameDay(task.dueDate, selectedDate)
  );

  const getTasksForDay = (day: Date) => {
    return mockTasks.filter(task => isSameDay(task.dueDate, day));
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 bg-card border-b border-border z-40">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground">{format(selectedDate, 'MMMM yyyy')}</p>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-4 space-y-6">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-2 mb-4">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {daysInMonth.map(day => {
                const tasksForDay = getTasksForDay(day);
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentDay = isToday(day);
                
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      aspect-square rounded-lg p-2 text-sm font-medium transition-all
                      ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}
                      ${isCurrentDay && !isSelected ? 'border-2 border-primary' : ''}
                      relative
                    `}
                  >
                    {format(day, 'd')}
                    {tasksForDay.length > 0 && (
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                        {tasksForDay.slice(0, 3).map((_, i) => (
                          <div key={i} className="w-1 h-1 rounded-full bg-accent" />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              Tasks on {format(selectedDate, 'MMMM d, yyyy')}
            </h2>
          </div>

          {tasksOnSelectedDate.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No tasks scheduled for this day</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tasksOnSelectedDate.map(task => {
                const property = mockProperties.find(p => p.id === task.propertyId)!;
                return (
                  <Card 
                    key={task.id} 
                    className="cursor-pointer transition-all hover:shadow-md active:scale-[0.98]"
                    onClick={() => navigate(`/task/${task.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold flex-1">{task.title}</h3>
                        <Badge className={getStatusColor(task.status)} variant="secondary">
                          {task.status.replace('-', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                        {task.description}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{property.name}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Schedule;
