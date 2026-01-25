import { ServiceForm } from "./service-form";

export default function NewServicePage() {
    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Add New Service</h1>
                <p className="text-muted-foreground">Define what you help your clients with.</p>
            </div>
            <ServiceForm />
        </div>
    );
}
