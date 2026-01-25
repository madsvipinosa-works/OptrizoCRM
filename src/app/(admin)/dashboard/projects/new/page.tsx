import { ProjectForm } from "./ProjectForm";

export default function NewProjectPage() {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Add New Project</h1>
                <p className="text-muted-foreground">Create a case study to display on your portfolio.</p>
            </div>
            <ProjectForm />
        </div>
    );
}
