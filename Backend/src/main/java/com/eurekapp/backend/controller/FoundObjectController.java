package com.eurekapp.backend.controller;

import com.eurekapp.backend.dto.FoundObjectDto;
import com.eurekapp.backend.dto.command.FoundObjectDetailCommand;
import com.eurekapp.backend.dto.response.FoundObjectUploadedResponseDto;
import com.eurekapp.backend.dto.FoundObjectsListDto;
import com.eurekapp.backend.dto.ReturnFoundObjectDto;
import com.eurekapp.backend.model.*;
import com.eurekapp.backend.service.IFoundObjectService;
import com.eurekapp.backend.service.ReturnFoundObjectService;
import jakarta.validation.constraints.Past;
import org.hibernate.validator.constraints.Length;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/found-objects")
@CrossOrigin("*")
public class FoundObjectController {
    @Autowired
    private IFoundObjectService foundObjectService;
    @Autowired
    private ReturnFoundObjectService returnFoundObjectService;

    /***
     *  Endpoint usado en la pantalla "Receptar un objeto", para cargar un objeto encontrado y que sea inventariado
     *  por la organización que lo retendrá.
     * ***/
    /*public ResponseEntity<Void> uploadFoundObject(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") @Length(max = 30, message = "Max description size is 30") String title,
            @RequestParam(value = "detailed_description", required = false) String detailedDescription,
            @RequestParam(value = "found_date") LocalDateTime foundDate,
            @RequestParam(value = "latitude", required = false) Double latitude,
            @RequestParam(value = "longitude", required = false) Double longitude,
            @PathVariable(value = "organizationId", required = false) Long organizationId) {
        return ResponseEntity.ok().build();
    }*/
    @PostMapping(value = "/organizations/{organizationId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<FoundObjectUploadedResponseDto> uploadFoundObject(
            @RequestParam("title") @Length(max = 30, message = "Max description size is 30") String title,
            @RequestParam("object_finder_username") String objectFinderUsername,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "detailed_description", required = false) String detailedDescription,
            @RequestParam(value = "found_date") LocalDateTime foundDate,
            @RequestParam(value = "latitude", required = false) Double latitude,
            @RequestParam(value = "longitude", required = false) Double longitude,
            @PathVariable(value = "organizationId", required = false) Long organizationId){
        UploadFoundObjectCommand command = UploadFoundObjectCommand.builder()
                .title(title)
                .objectFinderUsername(objectFinderUsername)
                .image(file)
                .foundDate(foundDate)
                .organizationId(organizationId)
                .latitude(latitude)
                .longitude(longitude)
                .detailedDescription(detailedDescription != null ? detailedDescription : "")
                .build();
        return ResponseEntity.ok(foundObjectService.uploadFoundObject(command));
    }

    /***
     *  Este endpoint es usado en la pantalla "Buscar un objeto", cuando los datos provistos son descripción,
     *  organización en la que el usuario cree haber perdido el objeto, y fecha-hora en la que cree haberlo perdido.
     * ***/
    @GetMapping("/organizations/{organizationId}")
    public ResponseEntity<FoundObjectsListDto> searchFoundObjectsByOrganization(
            @RequestParam @Length(max = 255, message = "Max length supported is 255") String query,
            @PathVariable(name = "organizationId", required = false) Long organizationId,
            @RequestParam(name = "lost_date", required = false) LocalDateTime lostDate){

        // Si bien el frontend siempre nos enviará coordenadas (porque las mismas tienen un valor por defecto),
        // cuando el usuario haya seleccionado una organización las ignoraremos a la hora de construir el objeto command.
        SimilarObjectsCommand command = SimilarObjectsCommand.builder()
                .query(query)
                .organizationId(organizationId)
                .lostDate(lostDate)
                .build();
        return ResponseEntity.ok(foundObjectService.getFoundObjectByTextDescription(command));
    }

    /***
     *  Este endpoint es usado en la pantalla "Buscar un objeto", cuando los datos provistos son descripción,
     *  coordenadas del lugar en el que el usuario cree haberlo perdido, y fecha-hora en la que cree haberlo perdido.
     * ***/
    @GetMapping
    public ResponseEntity<FoundObjectsListDto> searchFoundObjectsByCoordinates(
            @RequestParam @Length(max = 255, message = "Max length supported is 255") String query,
            @RequestParam(name = "lost_date", required = false) @Past LocalDateTime lostDate,
            @RequestParam(name="latitude", required = true) Double latitude,
            @RequestParam(name="longitude", required = true) Double longitude){
        SimilarObjectsCommand command = SimilarObjectsCommand.builder()
                .query(query)
                .lostDate(lostDate)
                .latitude(latitude)
                .longitude(longitude)
                .build();
        return ResponseEntity.ok(foundObjectService.getFoundObjectByTextDescription(command));
    }

    /***
     *  Endpoint usado para que un usuario de organización pueda ver todos los objetos que la organización actualmente
     *  tiene en su poder.
     * ***/
    @GetMapping("/organizations/all/{organizationId}")
    public ResponseEntity<FoundObjectsListDto> getAllUnreturnedFoundObjectsByOrganization(
            @PathVariable(name = "organizationId", required = false) Long organizationId){
        SimilarObjectsCommand command = SimilarObjectsCommand.builder()
                .organizationId(organizationId)
                .build();
        return ResponseEntity.ok(foundObjectService.getAllUnreturnedFoundObjectsByOrganization(command));
    }

    /***
     *  Endpoint usado en la pantalla "Devolver un objeto", para asentar la devolución.
     * ***/
    @PostMapping(value= "/return/{organizationId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ReturnFoundObjectDto> returnLostObject(
            @RequestParam(value = "username", required = false) String eurekappUser,
            @RequestParam(value = "dni", required = true) String dni,
            @RequestParam(value = "phoneNumber", required = true) String phoneNumber,
            @RequestParam(value = "found_object_uuid", required = true) String uuid,
            @RequestParam(value = "file", required = true) MultipartFile file,
            @PathVariable(name = "organizationId") Long organizationId) {
        ReturnFoundObjectCommand command = ReturnFoundObjectCommand.builder()
                .organizationId(organizationId)
                .foundObjectUUID(uuid)
                .DNI(dni)
                .phoneNumber(phoneNumber)
                .username(eurekappUser)
                .image(file)
                .build();
        return ResponseEntity.ok(returnFoundObjectService.returnFoundObject(command));
    }

    /**
     * Endpoint usado para obtener los detalles de un objeto encontrado (haya sido devuelto o no).
     * */
    @PostMapping("/getDetail")
    public ResponseEntity<FoundObjectDto> getFoundObjectDetail(@RequestBody(required = true) FoundObjectDetailCommand command){
        return ResponseEntity.ok(foundObjectService.getFoundObjectDetail(command) );
    }


    /***
     * Endpoint usado por un usuario organizacional para obtener todos los objetos que la organización haya devuelto
     * */
    @GetMapping("/getReturnedObjects")
    public ResponseEntity<FoundObjectsListDto> getReturnedObjects(@AuthenticationPrincipal UserEurekapp user){
        return ResponseEntity.ok(foundObjectService.getAllReturnedFoundObjectsByOrganization(user));
    }

    /***
     * Endpoint usado por un usuario organizacional para obtener los detalles de una devolución de un objeto.
     * */
    @PostMapping("/getReturnedObject")
    public ResponseEntity<ReturnFoundObjectDto> getReturnFoundObjectByFoundObjectId(@AuthenticationPrincipal UserEurekapp user,
                                                                                @RequestBody(required = true) GetReturnFoundObjectCommand command){
        return ResponseEntity.ok(returnFoundObjectService.getReturnFoundObject(user, command.getFoundObjectUUID()));
    }

}
