export function getClientFacingProjectStatus(status: string) {
    return status === "In Review" ? "Waiting on your review" : status;
}

export function getClientFacingMilestoneStatus(status: string) {
    return status === "Client Approval" ? "Waiting on your review" : status;
}

export function getClientFacingFeedbackStatus(status: string) {
    switch (status) {
        case "APPROVED":
            return "Approved";
        case "REVISION_REQUESTED":
            return "Changes Requested";
        default:
            return status.replace(/_/g, " ");
    }
}
