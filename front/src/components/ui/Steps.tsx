import { ChevronRight } from "lucide-react";

export default function Steps() {
    return (
        <div className="pt-10 flex gap-1">
            <p>Home</p>
            <ChevronRight />
            <p>Roteiros</p>
             <ChevronRight />
            <p className="font-semibold">Programação da viagem</p>
        </div>
    );
}