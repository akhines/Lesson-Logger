import { useMemo } from "react";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import type { Assignment, Subject, Lesson, Student } from "@shared/schema";
import { SUBJECT_CATEGORY_COLORS } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";

interface Props {
  assignments: Assignment[];
  lessons: Lesson[];
  subjects: Subject[];
  students: Student[];
  weekStart: Date;
  onAssignmentClick?: (assignment: Assignment) => void;
}

export function WeeklyAssignmentView({
  assignments,
  lessons,
  subjects,
  students,
  weekStart,
  onAssignmentClick,
}: Props) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(weekStart, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  const getSubjectForAssignment = (assignment: Assignment): Subject | undefined => {
    const lesson = lessons.find(l => l.id === assignment.lessonId);
    if (!lesson) return undefined;
    return subjects.find(s => s.id === lesson.subjectId);
  };

  const getStudentForAssignment = (assignment: Assignment): Student | undefined => {
    const subject = getSubjectForAssignment(assignment);
    if (!subject?.studentId) return undefined;
    return students.find(s => s.id === subject.studentId);
  };

  const getAssignmentColor = (assignment: Assignment): string => {
    const subject = getSubjectForAssignment(assignment);
    if (subject?.category) {
      return SUBJECT_CATEGORY_COLORS[subject.category] || SUBJECT_CATEGORY_COLORS.other;
    }
    return SUBJECT_CATEGORY_COLORS.other;
  };

  const getAssignmentsForDay = (day: Date): Assignment[] => {
    return assignments.filter(a => {
      if (!a.dueDate) return false;
      return isSameDay(parseISO(a.dueDate), day);
    });
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="grid grid-cols-7">
        {weekDays.map((day, i) => (
          <div
            key={i}
            className={`p-3 text-center border-b border-border ${i < 6 ? 'border-r' : ''} bg-muted/30`}
          >
            <div className="text-xs text-muted-foreground font-medium">
              {format(day, "EEE")}
            </div>
            <div className="text-lg font-bold">{format(day, "d")}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 min-h-[300px]">
        {weekDays.map((day, i) => {
          const dayAssignments = getAssignmentsForDay(day);
          return (
            <div
              key={i}
              className={`p-2 ${i < 6 ? 'border-r border-border' : ''} min-h-[200px]`}
            >
              <div className="space-y-2">
                {dayAssignments.map((assignment) => {
                  const student = getStudentForAssignment(assignment);
                  const color = getAssignmentColor(assignment);
                  const isComplete = assignment.status === "graded" || assignment.status === "submitted";
                  
                  return (
                    <div
                      key={assignment.id}
                      onClick={() => onAssignmentClick?.(assignment)}
                      className="p-2 rounded-md text-white text-xs cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md"
                      style={{ backgroundColor: color }}
                      data-testid={`weekly-assignment-${assignment.id}`}
                    >
                      <div className="flex items-start gap-1">
                        {isComplete ? (
                          <CheckCircle2 className="h-3 w-3 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="h-3 w-3 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{assignment.title}</div>
                          {student && (
                            <div 
                              className="flex items-center gap-1 mt-1"
                            >
                              <div 
                                className="h-2 w-2 rounded-full" 
                                style={{ backgroundColor: student.color || '#fff' }}
                              />
                              <span className="opacity-90 truncate">{student.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
