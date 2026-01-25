import { AppLayout } from "@/components/AppLayout";
import { useStudents, useCreateStudent, useUpdateStudent, useDeleteStudent } from "@/hooks/use-students";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MoreVertical, Trash2, Pencil, Key, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import type { Student } from "@shared/schema";
import { STUDENT_COLORS, STUDENT_AVATARS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { AvatarSelector, StudentAvatar } from "@/components/AvatarSelector";

interface StudentFormData {
  name: string;
  gradeLevel: string;
  color: string;
  pin: string;
  username: string;
  avatar: string;
}

export default function Students() {
  const { data: students, isLoading } = useStudents();
  const createMutation = useCreateStudent();
  const updateMutation = useUpdateStudent();
  const deleteMutation = useDeleteStudent();
  const { toast } = useToast();
  const [editingStudent, setEditingStudent] = useState<Student | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<StudentFormData>({
    defaultValues: {
      name: "",
      gradeLevel: "",
      color: STUDENT_COLORS[0],
      pin: "",
      username: "",
      avatar: STUDENT_AVATARS[0],
    },
  });

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this student? This will not delete their subjects.")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Student deleted" });
      } catch (error) {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    form.reset({
      name: student.name,
      gradeLevel: student.gradeLevel || "",
      color: student.color || STUDENT_COLORS[0],
      pin: student.pin || "",
      username: student.username || "",
      avatar: student.avatar || STUDENT_AVATARS[0],
    });
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingStudent(undefined);
    // Auto-select a unique color and avatar for new students
    const usedColors = students?.map(s => s.color) || [];
    const usedAvatars = students?.map(s => s.avatar) || [];
    const availableColor = STUDENT_COLORS.find(c => !usedColors.includes(c)) || STUDENT_COLORS[0];
    const availableAvatar = STUDENT_AVATARS.find(a => !usedAvatars.includes(a)) || STUDENT_AVATARS[0];
    form.reset({ name: "", gradeLevel: "", color: availableColor, pin: "", username: "", avatar: availableAvatar });
    setDialogOpen(true);
  };

  const onSubmit = async (data: StudentFormData) => {
    try {
      if (editingStudent) {
        await updateMutation.mutateAsync({ id: editingStudent.id, ...data });
        toast({ title: "Student updated" });
      } else {
        await createMutation.mutateAsync(data);
        toast({ title: "Student added" });
      }
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const grades = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Students</h1>
          <p className="text-muted-foreground">Manage your children and their progress.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} className="gap-2 shadow-lg shadow-primary/20" data-testid="button-add-student">
              <span className="text-lg">+</span> Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-display">
                {editingStudent ? "Edit Student" : "New Student"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="avatar"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Choose an Avatar</FormLabel>
                      <FormDescription>Pick a fun character for the student portal</FormDescription>
                      <FormControl>
                        <AvatarSelector value={field.value} onChange={field.onChange} size="sm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  rules={{ required: "Name is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter child's name" {...field} data-testid="input-student-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="username"
                  rules={{ 
                    required: "Username is required for login",
                    minLength: { value: 3, message: "Username must be at least 3 characters" },
                    pattern: { value: /^[a-z0-9_]+$/, message: "Only lowercase letters, numbers, and underscores" }
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormDescription>Used to log in to the student portal</FormDescription>
                      <FormControl>
                        <Input 
                          placeholder="e.g. emma_learns" 
                          {...field} 
                          onChange={(e) => field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          data-testid="input-student-username" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grade Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-student-grade">
                            <SelectValue placeholder="Select Grade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {grades.map((grade) => (
                            <SelectItem key={grade} value={grade}>
                              Grade {grade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormDescription>Used to identify this student on the calendar</FormDescription>
                      <div className="flex gap-2 flex-wrap">
                        {STUDENT_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`h-8 w-8 rounded-full border-2 transition-all ${field.value === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                            style={{ backgroundColor: color }}
                            onClick={() => field.onChange(color)}
                            data-testid={`color-option-${color}`}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student PIN (Optional)</FormLabel>
                      <FormDescription>4-6 digit PIN for student to log in</FormDescription>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="1234" 
                          maxLength={6}
                          {...field} 
                          data-testid="input-student-pin" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isPending}
                  data-testid="button-submit-student"
                >
                  {isPending ? "Saving..." : (editingStudent ? "Save Changes" : "Add Student")}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students?.map((student) => (
            <Card key={student.id} className="group hover:shadow-lg transition-all duration-300 border-border/60" data-testid={`card-student-${student.id}`}>
              <CardHeader className="flex flex-row items-start justify-between pb-2 gap-2">
                <div className="flex items-center gap-3">
                  <div className="group-hover:scale-110 transition-transform duration-300">
                    <StudentAvatar avatar={student.avatar} size="md" />
                  </div>
                  <div>
                    <CardTitle className="text-lg" data-testid={`text-student-name-${student.id}`}>{student.name}</CardTitle>
                    {student.username && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        @{student.username}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`button-student-menu-${student.id}`}>
                      <span className="sr-only">Open menu</span>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(student)} data-testid={`button-edit-student-${student.id}`}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(student.id)}
                      className="text-destructive focus:text-destructive"
                      data-testid={`button-delete-student-${student.id}`}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {student.gradeLevel ? `Grade ${student.gradeLevel}` : "Grade level not set"}
                </p>
              </CardContent>
              <CardFooter className="pt-0 flex flex-wrap gap-2">
                <div className="text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-md">
                  Active Student
                </div>
                {student.pin && (
                  <div className="text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-md flex items-center gap-1">
                    <Key className="h-3 w-3" /> PIN Set
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
          
          {students?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-3xl bg-muted/5">
              <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-bold">No students yet</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">Add your first child to start organizing their curriculum.</p>
              <Button onClick={handleCreate} data-testid="button-add-first-student">Add Student</Button>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
