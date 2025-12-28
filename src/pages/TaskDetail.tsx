import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, MapPin, User, AlertCircle, Clock, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useDataContext } from '@/contexts/DataContext';
import { ChatThread } from '@/components/messaging/ChatThread';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';
import { EmptyState } from '@/components/design-system/EmptyState';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

const getStatusColor = (status: TaskStatus) => {
  switch (status) {
    case 'completed':
      return 'bg-success text-success-foreground';
    case 'in_progress':
      return 'bg-warning text-warning-foreground';
    case 'pending':
      return 'bg-primary text-primary-foreground';
    case 'cancelled':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-primary text-primary-foreground';
  }
};

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  due_date: string | null;
  created_at: string;
  property_id: string | null;
  assigned_user_id: string | null;
}

interface PropertyData {
  id: string;
  nickname: string | null;
  address: string;
}

const TaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { orgId } = useDataContext();
  
  const [task, setTask] = useState<TaskData | null>(null);
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TaskStatus>('pending');

  useEffect(() => {
    async function fetchTask() {
      if (!id || !orgId) {
        setLoading(false);
        return;
      }

      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('id, title, description, status, priority, due_date, created_at, property_id, assigned_user_id')
        .eq('id', id)
        .eq('org_id', orgId)
        .single();

      if (taskError || !taskData) {
        setLoading(false);
        return;
      }

      setTask(taskData as TaskData);
      setStatus((taskData.status as TaskStatus) || 'pending');

      if (taskData.property_id) {
        const { data: propData } = await supabase
          .from('properties')
          .select('id, nickname, address')
          .eq('id', taskData.property_id)
          .single();
        
        if (propData) {
          setProperty(propData);
        }
      }

      setLoading(false);
    }

    fetchTask();
  }, [id, orgId]);

  if (loading) {
    return (
      <StandardPageWithBack
        title="Task Details"
        backTo="/tasks"
        icon={<CheckSquare className="h-6 w-6" />}
        maxWidth="md"
      >
        <LoadingState message="Loading task..." />
      </StandardPageWithBack>
    );
  }

  if (!task) {
    return (
      <StandardPageWithBack
        title="Task Details"
        backTo="/tasks"
        icon={<CheckSquare className="h-6 w-6" />}
        maxWidth="md"
      >
        <EmptyState
          icon={CheckSquare}
          title="Task not found"
          description="The task you're looking for doesn't exist"
          action={{
            label: "Go back",
            onClick: () => navigate('/tasks')
          }}
        />
      </StandardPageWithBack>
    );
  }

  const handleStatusChange = (newStatus: TaskStatus) => {
    setStatus(newStatus);
    toast({
      title: "Status updated",
      description: `Task marked as ${newStatus.replace('-', ' ')}`,
    });
  };

  return (
    <StandardPageWithBack
      title={task.title}
      subtitle={property ? property.nickname || property.address : undefined}
      backTo="/tasks"
      icon={<CheckSquare className="h-6 w-6" />}
      maxWidth="md"
    >
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-bold leading-tight">{task.title}</h2>
            <Badge className={getStatusColor(status)} variant="secondary">
              {status.replace('-', ' ')}
            </Badge>
          </div>

          <p className="text-muted-foreground leading-relaxed">{task.description}</p>
        </div>

        {property && (
          <Card className="shadow-e1">
            <CardHeader>
              <CardTitle className="text-lg">Property Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{property.nickname || 'Property'}</p>
                  <p className="text-sm text-muted-foreground">{property.address}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-lg">Task Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">
                  {task.due_date ? format(new Date(task.due_date), 'EEEE, MMMM d, yyyy') : 'No due date'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Priority</p>
                <p className="font-medium capitalize">{task.priority || 'medium'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Assigned To</p>
                <p className="font-medium">{task.assigned_user_id || 'Unassigned'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{format(new Date(task.created_at), 'MMM d, yyyy')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-lg">Update Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
              <SelectTrigger className="input-neomorphic">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Chat Thread */}
        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-lg">Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <ChatThread taskId={id!} />
          </CardContent>
        </Card>
      </div>
    </StandardPageWithBack>
  );
};

export default TaskDetail;
